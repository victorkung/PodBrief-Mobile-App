import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  Modal,
  TextInput,
  Dimensions,
  Animated,
  Text,
} from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import Svg, {
  Rect,
  Path,
  G,
  Line,
  Circle,
  Defs,
  LinearGradient,
  Stop,
} from "react-native-svg";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Spacing, BorderRadius } from "@/constants/theme";

interface UserAnalyticsResponse {
  summary: {
    totalSummaries: number;
    totalEpisodes: number;
    totalShowsFollowing: number;
    totalTimeSavedMinutes: number;
  };
  favoritePodcasts: Array<{
    podcastName: string;
    imageUrl: string | null;
    summaryCount: number;
    episodeCount: number;
    totalEngagements: number;
  }>;
  activityTimeline: Array<{
    date: string;
    summariesCompleted: number;
    episodesCompleted: number;
    timeSavedHours: number;
  }>;
  genreBreakdown: Array<{
    genre: string;
    count: number;
  }>;
}

type DateRange = "7d" | "30d" | "90d" | "1y" | "custom";

const DATE_RANGE_LABELS: Record<DateRange, string> = {
  "7d": "Last 7 Days",
  "30d": "Last 30 Days",
  "90d": "Last 90 Days",
  "1y": "Last Year",
  custom: "Custom Range",
};

const GENRE_COLORS = [
  "#E8BA30",
  "#2DD4A0",
  "#F97316",
  "#A855F7",
  "#3B82F6",
  "#EC4899",
  "#06B6D4",
  "#84CC16",
  "#F59E0B",
  "#6366F1",
];

const GOLD = "#E8BA30";
const TEAL = "#2DD4A0";
const ORANGE = "#F97316";

function formatTimeSaved(minutes: number): string {
  if (minutes < 1) return "0 minutes";
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hours === 0) return `${mins} minute${mins !== 1 ? "s" : ""}`;
  if (mins === 0) return `${hours} hour${hours !== 1 ? "s" : ""}`;
  return `${hours} hour${hours !== 1 ? "s" : ""} ${mins} min`;
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function getDateRange(range: DateRange, customStart: string, customEnd: string): { startDate: string; endDate: string } {
  const now = new Date();
  const endDate = now.toISOString().split("T")[0];

  if (range === "custom") {
    return { startDate: customStart, endDate: customEnd || endDate };
  }

  const daysMap: Record<string, number> = {
    "7d": 7,
    "30d": 30,
    "90d": 90,
    "1y": 365,
  };

  const days = daysMap[range] || 365;
  const start = new Date(now.getTime() - days * 86400000);
  return { startDate: start.toISOString().split("T")[0], endDate };
}

function describeArc(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number
): string {
  const start = {
    x: cx + r * Math.cos(startAngle),
    y: cy + r * Math.sin(startAngle),
  };
  const end = {
    x: cx + r * Math.cos(endAngle),
    y: cy + r * Math.sin(endAngle),
  };
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

export default function AnalyticsScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();

  const [data, setData] = useState<UserAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dateRange, setDateRange] = useState<DateRange>("1y");
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [activityMode, setActivityMode] = useState<"daily" | "cumulative">("daily");
  const [timeSavedMode, setTimeSavedMode] = useState<"daily" | "cumulative">("daily");
  const [selectedPoint, setSelectedPoint] = useState<{chartKey: string, index: number, x: number, y: number, date: string, values: string[]} | null>(null);

  const pulseAnim = useRef(new Animated.Value(0.3)).current;

  const screenWidth = Dimensions.get("window").width;
  const chartWidth = screenWidth - Spacing.lg * 4 - Spacing.lg * 2;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  const fetchAnalytics = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const { startDate, endDate } = getDateRange(dateRange, customStartDate, customEndDate);
      const startISO = new Date(startDate + "T00:00:00.000Z").toISOString();
      const endISO = new Date(endDate + "T23:59:59.999Z").toISOString();
      const { data: result, error: fnError } = await supabase.functions.invoke(
        "user-analytics",
        { body: { startDate: startISO, endDate: endISO } }
      );
      if (fnError) throw fnError;
      if (result && typeof result === "object") {
        setData(result as UserAnalyticsResponse);
      } else {
        setData({
          summary: { totalSummaries: 0, totalEpisodes: 0, totalShowsFollowing: 0, totalTimeSavedMinutes: 0 },
          favoritePodcasts: [],
          activityTimeline: [],
          genreBreakdown: [],
        });
      }
    } catch (e: any) {
      console.error("[Analytics] Error fetching:", e);
      setError(e?.message || "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, [user, dateRange, customStartDate, customEndDate]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const handleSelectRange = (range: DateRange) => {
    if (range === "custom") {
      setDateRange("custom");
      return;
    }
    setDateRange(range);
    setFilterModalVisible(false);
  };

  const handleApplyCustomRange = () => {
    const oneYearAgo = new Date(Date.now() - 365 * 86400000);
    const startParsed = new Date(customStartDate);
    if (isNaN(startParsed.getTime()) || startParsed < oneYearAgo) {
      return;
    }
    setFilterModalVisible(false);
  };

  const isEmpty =
    data &&
    data.summary.totalSummaries === 0 &&
    data.summary.totalEpisodes === 0 &&
    data.summary.totalShowsFollowing === 0 &&
    data.summary.totalTimeSavedMinutes === 0;

  const renderSkeleton = () => (
    <View>
      <View style={styles.summaryGrid}>
        {[0, 1, 2, 3].map((i) => (
          <Animated.View
            key={i}
            style={[
              styles.skeletonCard,
              {
                backgroundColor: theme.backgroundSecondary,
                opacity: pulseAnim,
              },
            ]}
          />
        ))}
      </View>
      {[0, 1, 2].map((i) => (
        <Animated.View
          key={i}
          style={[
            styles.skeletonChart,
            {
              backgroundColor: theme.backgroundSecondary,
              opacity: pulseAnim,
            },
          ]}
        />
      ))}
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Feather name="bar-chart-2" size={48} color={theme.textTertiary} />
      <ThemedText
        type="body"
        style={[styles.emptyText, { color: theme.textSecondary }]}
      >
        {"No data yet \u2014 Start generating summaries and saving episodes to see your listening analytics here."}
      </ThemedText>
    </View>
  );

  const renderError = () => (
    <View style={styles.emptyContainer}>
      <Feather name="alert-circle" size={48} color={theme.error} />
      <ThemedText
        type="body"
        style={[styles.emptyText, { color: theme.textSecondary }]}
      >
        {error || "Something went wrong"}
      </ThemedText>
      <Button onPress={fetchAnalytics} style={{ marginTop: Spacing.lg }}>
        Retry
      </Button>
    </View>
  );

  const renderSummaryCards = () => {
    if (!data) return null;
    const cards = [
      {
        icon: "clock" as const,
        value: formatTimeSaved(data.summary.totalTimeSavedMinutes),
        label: "Time Saved",
      },
      {
        icon: "file-text" as const,
        value: String(data.summary.totalSummaries),
        label: "Summaries",
      },
      {
        icon: "headphones" as const,
        value: String(data.summary.totalEpisodes),
        label: "Episodes",
      },
      {
        icon: "radio" as const,
        value: String(data.summary.totalShowsFollowing),
        label: "Shows",
      },
    ];

    return (
      <View style={styles.summaryGrid}>
        {cards.map((card, idx) => (
          <Card
            key={idx}
            style={StyleSheet.flatten([
              styles.statCard,
              { backgroundColor: theme.backgroundDefault },
            ])}
          >
            <Feather name={card.icon} size={24} color={theme.gold} />
            <ThemedText type="h2" style={styles.statValue}>
              {card.value}
            </ThemedText>
            <ThemedText
              type="caption"
              style={{ color: theme.textSecondary }}
            >
              {card.label}
            </ThemedText>
          </Card>
        ))}
      </View>
    );
  };

  const renderHorizontalBarChart = () => {
    if (!data || data.favoritePodcasts.length === 0) return null;

    const podcasts = data.favoritePodcasts.slice(0, 8);
    const maxVal = Math.max(
      ...podcasts.map((p) => p.summaryCount + p.episodeCount),
      1
    );
    const barHeight = 24;
    const rowHeight = 40;
    const labelWidth = 120;
    const barAreaWidth = chartWidth - labelWidth - 8;
    const svgHeight = podcasts.length * rowHeight + 8;
    const titleHeight = 28;

    return (
      <Card
        style={StyleSheet.flatten([
          styles.chartCard,
          { backgroundColor: theme.backgroundDefault },
        ])}
      >
        <ThemedText type="h4" style={styles.sectionTitle}>
          Favorite Shows
        </ThemedText>
        <View style={{ position: "relative", height: svgHeight }}>
          <Svg width={chartWidth} height={svgHeight}>
            {podcasts.map((p, idx) => {
              const total = p.summaryCount + p.episodeCount;
              const summaryWidth = (p.summaryCount / maxVal) * barAreaWidth;
              const episodeWidth = (p.episodeCount / maxVal) * barAreaWidth;
              const y = idx * rowHeight + 4;

              return (
                <G key={idx}>
                  <Rect
                    x={labelWidth + 8}
                    y={y + (rowHeight - barHeight) / 2}
                    width={Math.max(summaryWidth, 0)}
                    height={barHeight}
                    rx={4}
                    fill={GOLD}
                  />
                  <Rect
                    x={labelWidth + 8 + summaryWidth}
                    y={y + (rowHeight - barHeight) / 2}
                    width={Math.max(episodeWidth, 0)}
                    height={barHeight}
                    rx={total > 0 && p.summaryCount === 0 ? 4 : 0}
                    fill={TEAL}
                  />
                </G>
              );
            })}
          </Svg>
          <View style={{ position: "absolute", top: 0, left: 0 }}>
            {podcasts.map((p, idx) => {
              const name =
                p.podcastName.length > 18
                  ? p.podcastName.substring(0, 18) + "..."
                  : p.podcastName;
              return (
                <View
                  key={idx}
                  style={{
                    height: rowHeight,
                    justifyContent: "center",
                    marginTop: idx === 0 ? 4 : 0,
                  }}
                >
                  <Text
                    style={{
                      color: theme.text,
                      fontSize: 12,
                      fontFamily: "GoogleSansFlex",
                    }}
                    numberOfLines={1}
                  >
                    {name}
                  </Text>
                </View>
              );
            })}
          </View>
          <View style={{ position: "absolute", top: 0, right: 0 }}>
            {podcasts.map((p, idx) => {
              const total = p.summaryCount + p.episodeCount;
              const barEnd = labelWidth + 8 + (total / maxVal) * barAreaWidth;
              return (
                <View
                  key={idx}
                  style={{
                    height: rowHeight,
                    justifyContent: "center",
                    alignItems: "flex-end",
                    marginTop: idx === 0 ? 4 : 0,
                  }}
                >
                  <Text
                    style={{
                      color: theme.textSecondary,
                      fontSize: 10,
                      fontFamily: "GoogleSansFlex",
                    }}
                  >
                    {p.summaryCount}s {p.episodeCount}e
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: GOLD }]} />
            <ThemedText type="caption">Summaries Completed</ThemedText>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: TEAL }]} />
            <ThemedText type="caption">Episodes Completed</ThemedText>
          </View>
        </View>
      </Card>
    );
  };

  const renderDonutChart = () => {
    if (!data || !data.favoritePodcasts) return null;

    const genres = data.genreBreakdown;
    const size = 180;
    const cx = size / 2;
    const cy = size / 2;
    const r = (size - 24) / 2;
    const strokeWidth = 24;

    if (genres.length === 0) {
      return (
        <Card
          style={StyleSheet.flatten([
            styles.chartCard,
            { backgroundColor: theme.backgroundDefault },
          ])}
        >
          <ThemedText type="h4" style={styles.sectionTitle}>
            Genre Breakdown
          </ThemedText>
          <ThemedText
            type="small"
            style={{ color: theme.textTertiary, textAlign: "center" }}
          >
            Genre data will appear as podcasts are indexed
          </ThemedText>
        </Card>
      );
    }

    const total = genres.reduce((sum, g) => sum + g.count, 0);
    let currentAngle = -Math.PI / 2;

    const arcs = genres.map((g, idx) => {
      const sliceAngle = (g.count / total) * Math.PI * 2;
      const startAngle = currentAngle;
      const endAngle = currentAngle + sliceAngle;
      currentAngle = endAngle;

      const midAngle = startAngle + sliceAngle / 2;
      const arcCx = cx + r * Math.cos(midAngle);
      const arcCy = cy + r * Math.sin(midAngle);

      return {
        path: describeArc(cx, cy, r, startAngle, endAngle - 0.01),
        color: GENRE_COLORS[idx % GENRE_COLORS.length],
        genre: g.genre,
        count: g.count,
      };
    });

    return (
      <Card
        style={StyleSheet.flatten([
          styles.chartCard,
          { backgroundColor: theme.backgroundDefault },
        ])}
      >
        <ThemedText type="h4" style={styles.sectionTitle}>
          Genre Breakdown
        </ThemedText>
        <View style={styles.donutContainer}>
          <Svg width={size} height={size}>
            {arcs.map((arc, idx) => (
              <Path
                key={idx}
                d={arc.path}
                fill="none"
                stroke={arc.color}
                strokeWidth={strokeWidth}
                strokeLinecap="butt"
              />
            ))}
          </Svg>
        </View>
        <View style={styles.genreLegend}>
          {genres.map((g, idx) => {
            const percent = Math.round((g.count / total) * 100);
            return (
              <View key={idx} style={styles.genreLegendItem}>
                <View
                  style={[
                    styles.legendDot,
                    {
                      backgroundColor:
                        GENRE_COLORS[idx % GENRE_COLORS.length],
                    },
                  ]}
                />
                <ThemedText type="caption">
                  {g.genre} ({g.count}, {percent}%)
                </ThemedText>
              </View>
            );
          })}
        </View>
      </Card>
    );
  };

  const findNearestPointIndex = (touchX: number, pointPositions: Array<{ x: number }>) => {
    let nearestIdx = 0;
    let minDist = Infinity;
    for (let i = 0; i < pointPositions.length; i++) {
      const dist = Math.abs(touchX - pointPositions[i].x);
      if (dist < minDist) {
        minDist = dist;
        nearestIdx = i;
      }
    }
    return nearestIdx;
  };

  const handleChartTouch = (
    touchX: number,
    allPointPositions: Array<{ x: number; values: Array<{ y: number; value: number }>; date: string; index: number }>,
    chartKey: string,
    labels: string[]
  ) => {
    const nearestIdx = findNearestPointIndex(touchX, allPointPositions);
    const point = allPointPositions[nearestIdx];
    if (!point) return;
    const tooltipValues = labels.map((label, li) => `${label}: ${point.values[li]?.value ?? 0}`);
    const minY = Math.min(...point.values.map(v => v.y));
    setSelectedPoint({
      chartKey,
      index: point.index,
      x: point.x,
      y: minY,
      date: point.date,
      values: tooltipValues,
    });
  };

  const renderLineChart = (
    timelineData: Array<{ x: string; values: number[][] }>,
    colors: string[],
    labels: string[],
    isCumulative: boolean,
    chartKey: string
  ) => {
    if (timelineData.length === 0) return null;

    const chartHeight = 200;
    const paddingLeft = 40;
    const paddingBottom = 30;
    const paddingTop = 10;
    const paddingRight = 10;
    const drawWidth = chartWidth - paddingLeft - paddingRight;
    const drawHeight = chartHeight - paddingBottom - paddingTop;

    const allValues = timelineData.flatMap((d) => d.values.flat());
    const maxVal = Math.max(...allValues, 1);
    const niceMax = Math.ceil(maxVal / 4) * 4 || 4;

    const showDots = timelineData.length <= 30;

    const getX = (idx: number) =>
      paddingLeft +
      (timelineData.length > 1
        ? (idx / (timelineData.length - 1)) * drawWidth
        : drawWidth / 2);
    const getY = (val: number) =>
      paddingTop + drawHeight - (val / niceMax) * drawHeight;

    const ticks = [0, 1, 2, 3, 4].map((i) => Math.round((niceMax / 4) * i));

    const allPointPositions = timelineData.map((d, i) => ({
      x: getX(i),
      values: colors.map((_, lineIdx) => ({
        y: getY(d.values[lineIdx]?.[0] ?? 0),
        value: d.values[lineIdx]?.[0] ?? 0,
      })),
      date: d.x,
      index: i,
    }));

    const isSelected = selectedPoint && selectedPoint.chartKey === chartKey;

    return (
      <View
        style={{ position: "relative" }}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={(e) => {
          const touchX = e.nativeEvent.locationX;
          handleChartTouch(touchX, allPointPositions, chartKey, labels);
        }}
        onResponderMove={(e) => {
          const touchX = e.nativeEvent.locationX;
          handleChartTouch(touchX, allPointPositions, chartKey, labels);
        }}
        onResponderRelease={() => {
          setTimeout(() => setSelectedPoint(null), 1500);
        }}
      >
        <Svg width={chartWidth} height={chartHeight}>
          {ticks.map((tick, idx) => (
            <G key={`tick-${idx}`}>
              <Line
                x1={paddingLeft}
                y1={getY(tick)}
                x2={chartWidth - paddingRight}
                y2={getY(tick)}
                stroke={theme.border}
                strokeWidth={1}
                strokeDasharray="4,4"
              />
            </G>
          ))}

          {isSelected ? (
            <Line
              x1={selectedPoint.x}
              y1={paddingTop}
              x2={selectedPoint.x}
              y2={paddingTop + drawHeight}
              stroke={theme.textTertiary}
              strokeWidth={1}
              strokeDasharray="3,3"
            />
          ) : null}

          {colors.map((color, lineIdx) => {
            const points = timelineData.map((d, i) => ({
              x: getX(i),
              y: getY(d.values[lineIdx]?.[0] ?? 0),
            }));

            const linePath = points
              .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
              .join(" ");

            const fillPath =
              isCumulative && points.length > 1
                ? `${linePath} L ${points[points.length - 1].x} ${paddingTop + drawHeight} L ${points[0].x} ${paddingTop + drawHeight} Z`
                : "";

            return (
              <G key={`line-${lineIdx}`}>
                {isCumulative && fillPath ? (
                  <>
                    <Defs>
                      <LinearGradient
                        id={`${chartKey}-grad-${lineIdx}`}
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <Stop offset="0" stopColor={color} stopOpacity="0.3" />
                        <Stop offset="1" stopColor={color} stopOpacity="0.05" />
                      </LinearGradient>
                    </Defs>
                    <Path
                      d={fillPath}
                      fill={`url(#${chartKey}-grad-${lineIdx})`}
                    />
                  </>
                ) : null}
                <Path
                  d={linePath}
                  fill="none"
                  stroke={color}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                {showDots
                  ? points.map((p, pIdx) => (
                      <Circle
                        key={pIdx}
                        cx={p.x}
                        cy={p.y}
                        r={isSelected && selectedPoint.index === pIdx ? 5 : 3}
                        fill={color}
                      />
                    ))
                  : null}
              </G>
            );
          })}

          {isSelected ? (
            <>
              {allPointPositions[selectedPoint.index]?.values.map((v, vi) => (
                <Circle
                  key={`highlight-${vi}`}
                  cx={selectedPoint.x}
                  cy={v.y}
                  r={6}
                  fill="none"
                  stroke={colors[vi] || GOLD}
                  strokeWidth={2}
                  opacity={0.6}
                />
              ))}
            </>
          ) : null}
        </Svg>
        {isSelected ? (
          <View
            style={{
              position: "absolute",
              left: Math.max(0, Math.min(selectedPoint.x - 70, chartWidth - 140)),
              top: Math.max(0, selectedPoint.y - 60 - (selectedPoint.values.length * 14)),
              backgroundColor: "rgba(0,0,0,0.85)",
              borderRadius: BorderRadius.xs,
              paddingHorizontal: Spacing.sm,
              paddingVertical: Spacing.xs,
              minWidth: 120,
            }}
            pointerEvents="none"
          >
            <Text style={{ color: "#fff", fontSize: 10, fontFamily: "GoogleSansFlex", marginBottom: 2 }}>
              {formatDateLabel(selectedPoint.date)}
            </Text>
            {selectedPoint.values.map((v, vi) => (
              <Text key={vi} style={{ color: "#fff", fontSize: 10, fontFamily: "GoogleSansFlex" }}>
                {v}
              </Text>
            ))}
          </View>
        ) : null}
      </View>
    );
  };

  const renderYAxisLabels = (maxVal: number) => {
    const niceMax = Math.ceil(maxVal / 4) * 4 || 4;
    const ticks = [0, 1, 2, 3, 4].map((i) => Math.round((niceMax / 4) * i));
    const chartHeight = 200;
    const paddingBottom = 30;
    const paddingTop = 10;
    const drawHeight = chartHeight - paddingBottom - paddingTop;

    return (
      <View style={[styles.yAxisContainer, { height: chartHeight }]}>
        {ticks.map((tick, idx) => {
          const top =
            paddingTop + drawHeight - (tick / niceMax) * drawHeight - 6;
          return (
            <Text
              key={idx}
              style={[
                styles.yAxisLabel,
                {
                  top,
                  color: theme.textTertiary,
                },
              ]}
            >
              {String(tick)}
            </Text>
          );
        })}
      </View>
    );
  };

  const renderXAxisLabels = (dates: string[]) => {
    const labelCount = Math.min(5, dates.length);
    const labelStep = Math.max(
      1,
      Math.floor((dates.length - 1) / (labelCount - 1))
    );
    const paddingLeft = 40;
    const paddingRight = 10;
    const drawWidth = chartWidth - paddingLeft - paddingRight;
    const labelWidth = 30;
    const minLabelGap = labelWidth + 4;

    const indices: number[] = [];
    for (let i = 0; i < dates.length; i += labelStep) {
      indices.push(i);
    }
    if (indices[indices.length - 1] !== dates.length - 1 && dates.length > 1) {
      const lastIdx = dates.length - 1;
      const prevIdx = indices[indices.length - 1];
      const lastLeft = (lastIdx / (dates.length - 1)) * drawWidth;
      const prevLeft = (prevIdx / (dates.length - 1)) * drawWidth;
      if (lastLeft - prevLeft < minLabelGap) {
        indices.pop();
      }
      indices.push(lastIdx);
    }

    return (
      <View style={[styles.xAxisContainer, { marginLeft: paddingLeft }]}>
        {indices.map((idx) => {
          const left =
            dates.length > 1
              ? (idx / (dates.length - 1)) * drawWidth
              : drawWidth / 2;
          return (
            <Text
              key={idx}
              style={[
                styles.xAxisLabel,
                {
                  left: left - 15,
                  color: theme.textTertiary,
                },
              ]}
            >
              {formatDateLabel(dates[idx])}
            </Text>
          );
        })}
      </View>
    );
  };

  const renderActivityChart = () => {
    if (!data || data.activityTimeline.length === 0) return null;

    const timeline = data.activityTimeline;
    let summaries = timeline.map((t) => t.summariesCompleted);
    let episodes = timeline.map((t) => t.episodesCompleted);

    if (activityMode === "cumulative") {
      let sumAcc = 0;
      let epAcc = 0;
      summaries = summaries.map((v) => {
        sumAcc += v;
        return sumAcc;
      });
      episodes = episodes.map((v) => {
        epAcc += v;
        return epAcc;
      });
    }

    const timelineData = timeline.map((t, i) => ({
      x: t.date,
      values: [[summaries[i]], [episodes[i]]],
    }));

    const allVals = [...summaries, ...episodes];
    const maxVal = Math.max(...allVals, 1);

    return (
      <Card
        style={StyleSheet.flatten([
          styles.chartCard,
          { backgroundColor: theme.backgroundDefault },
        ])}
      >
        <View style={styles.chartHeader}>
          <ThemedText type="h4">Activity</ThemedText>
          <View
            style={[
              styles.segmentedControl,
              { backgroundColor: theme.backgroundSecondary },
            ]}
          >
            <Pressable
              onPress={() => setActivityMode("daily")}
              style={[
                styles.segmentButton,
                activityMode === "daily"
                  ? { backgroundColor: theme.backgroundTertiary }
                  : null,
              ]}
            >
              <ThemedText
                type="caption"
                style={{
                  color:
                    activityMode === "daily"
                      ? theme.text
                      : theme.textTertiary,
                }}
              >
                Daily
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() => setActivityMode("cumulative")}
              style={[
                styles.segmentButton,
                activityMode === "cumulative"
                  ? { backgroundColor: theme.backgroundTertiary }
                  : null,
              ]}
            >
              <ThemedText
                type="caption"
                style={{
                  color:
                    activityMode === "cumulative"
                      ? theme.text
                      : theme.textTertiary,
                }}
              >
                Cumulative
              </ThemedText>
            </Pressable>
          </View>
        </View>
        <View style={styles.chartArea}>
          {renderYAxisLabels(maxVal)}
          {renderLineChart(
            timelineData,
            [GOLD, TEAL],
            ["Summaries Completed", "Episodes Completed"],
            activityMode === "cumulative",
            "activity"
          )}
        </View>
        {renderXAxisLabels(timeline.map((t) => t.date))}
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: GOLD }]} />
            <ThemedText type="caption">Summaries Completed</ThemedText>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: TEAL }]} />
            <ThemedText type="caption">Episodes Completed</ThemedText>
          </View>
        </View>
      </Card>
    );
  };

  const renderSummariesVsEpisodes = () => {
    if (!data) return null;
    const s = data.summary.totalSummaries;
    const e = data.summary.totalEpisodes;
    if (s === 0 && e === 0) return null;

    const total = s + e;
    const size = 140;
    const cx = size / 2;
    const cy = size / 2;
    const r = (size - 24) / 2;
    const strokeWidth = 20;

    let currentAngle = -Math.PI / 2;
    const slices = [
      { value: s, color: GOLD, label: "Summaries Completed" },
      { value: e, color: TEAL, label: "Episodes Completed" },
    ].filter((sl) => sl.value > 0);

    const arcs = slices.map((sl) => {
      const sliceAngle = (sl.value / total) * Math.PI * 2;
      const startAngle = currentAngle;
      const endAngle = currentAngle + sliceAngle;
      currentAngle = endAngle;
      return {
        path: describeArc(
          cx,
          cy,
          r,
          startAngle,
          endAngle - (slices.length > 1 ? 0.03 : 0)
        ),
        color: sl.color,
        label: sl.label,
        value: sl.value,
      };
    });

    return (
      <Card
        style={StyleSheet.flatten([
          styles.chartCard,
          { backgroundColor: theme.backgroundDefault },
        ])}
      >
        <ThemedText type="h4" style={styles.sectionTitle}>
          Summaries vs Episodes
        </ThemedText>
        <View style={styles.donutContainer}>
          <Svg width={size} height={size}>
            {arcs.map((arc, idx) => (
              <Path
                key={idx}
                d={arc.path}
                fill="none"
                stroke={arc.color}
                strokeWidth={strokeWidth}
                strokeLinecap="butt"
              />
            ))}
          </Svg>
          <View style={[styles.donutCenter, { width: size, height: size }]}>
            <ThemedText type="h2">{String(total)}</ThemedText>
          </View>
        </View>
        <View style={styles.legendRow}>
          {arcs.map((arc, idx) => (
            <View key={idx} style={styles.legendItem}>
              <View
                style={[styles.legendDot, { backgroundColor: arc.color }]}
              />
              <ThemedText type="caption">
                {arc.label} ({arc.value})
              </ThemedText>
            </View>
          ))}
        </View>
      </Card>
    );
  };

  const renderTimeSavedChart = () => {
    if (!data || data.activityTimeline.length === 0) return null;

    const hasTimeSaved = data.activityTimeline.some(
      (t) => t.timeSavedHours > 0
    );
    if (!hasTimeSaved) return null;

    const timeline = data.activityTimeline;
    let hours = timeline.map((t) => t.timeSavedHours);

    if (timeSavedMode === "cumulative") {
      let acc = 0;
      hours = hours.map((v) => {
        acc += v;
        return acc;
      });
    }

    const timelineData = timeline.map((t, i) => ({
      x: t.date,
      values: [[hours[i]]],
    }));

    const maxVal = Math.max(...hours, 1);

    return (
      <Card
        style={StyleSheet.flatten([
          styles.chartCard,
          { backgroundColor: theme.backgroundDefault },
        ])}
      >
        <View style={styles.chartHeader}>
          <ThemedText type="h4">Time Saved (hours)</ThemedText>
          <View
            style={[
              styles.segmentedControl,
              { backgroundColor: theme.backgroundSecondary },
            ]}
          >
            <Pressable
              onPress={() => setTimeSavedMode("daily")}
              style={[
                styles.segmentButton,
                timeSavedMode === "daily"
                  ? { backgroundColor: theme.backgroundTertiary }
                  : null,
              ]}
            >
              <ThemedText
                type="caption"
                style={{
                  color:
                    timeSavedMode === "daily"
                      ? theme.text
                      : theme.textTertiary,
                }}
              >
                Daily
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() => setTimeSavedMode("cumulative")}
              style={[
                styles.segmentButton,
                timeSavedMode === "cumulative"
                  ? { backgroundColor: theme.backgroundTertiary }
                  : null,
              ]}
            >
              <ThemedText
                type="caption"
                style={{
                  color:
                    timeSavedMode === "cumulative"
                      ? theme.text
                      : theme.textTertiary,
                }}
              >
                Cumulative
              </ThemedText>
            </Pressable>
          </View>
        </View>
        <View style={styles.chartArea}>
          {renderYAxisLabels(maxVal)}
          {renderLineChart(
            timelineData,
            [ORANGE],
            ["Hours Saved"],
            timeSavedMode === "cumulative",
            "timesaved"
          )}
        </View>
        {renderXAxisLabels(timeline.map((t) => t.date))}
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: ORANGE }]} />
            <ThemedText type="caption">Hours Saved</ThemedText>
          </View>
        </View>
      </Card>
    );
  };

  const renderFilterModal = () => (
    <Modal
      visible={filterModalVisible}
      transparent
      animationType="fade"
      onRequestClose={() => setFilterModalVisible(false)}
    >
      <Pressable
        style={styles.modalOverlay}
        onPress={() => setFilterModalVisible(false)}
      >
        <View
          style={[
            styles.modalContainer,
            { backgroundColor: theme.backgroundDefault },
          ]}
        >
          <ThemedText type="h3" style={styles.modalTitle}>
            Select Date Range
          </ThemedText>
          {(["7d", "30d", "90d", "1y", "custom"] as DateRange[]).map(
            (range) => (
              <Pressable
                key={range}
                onPress={() => handleSelectRange(range)}
                style={[
                  styles.modalOption,
                  dateRange === range
                    ? { backgroundColor: theme.backgroundTertiary }
                    : null,
                ]}
              >
                <ThemedText
                  type="body"
                  style={{
                    color:
                      dateRange === range ? theme.gold : theme.text,
                  }}
                >
                  {DATE_RANGE_LABELS[range]}
                </ThemedText>
                {dateRange === range ? (
                  <Feather name="check" size={18} color={theme.gold} />
                ) : null}
              </Pressable>
            )
          )}
          {dateRange === "custom" ? (
            <View style={styles.customDateContainer}>
              <TextInput
                style={[
                  styles.dateInput,
                  {
                    color: theme.text,
                    backgroundColor: theme.backgroundSecondary,
                    borderColor: theme.border,
                  },
                ]}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={theme.textTertiary}
                value={customStartDate}
                onChangeText={setCustomStartDate}
              />
              <ThemedText
                type="caption"
                style={{ color: theme.textSecondary, marginHorizontal: Spacing.sm }}
              >
                to
              </ThemedText>
              <TextInput
                style={[
                  styles.dateInput,
                  {
                    color: theme.text,
                    backgroundColor: theme.backgroundSecondary,
                    borderColor: theme.border,
                  },
                ]}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={theme.textTertiary}
                value={customEndDate}
                onChangeText={setCustomEndDate}
              />
            </View>
          ) : null}
          {dateRange === "custom" ? (
            <Button
              onPress={handleApplyCustomRange}
              style={{ marginTop: Spacing.md }}
            >
              Apply
            </Button>
          ) : null}
        </View>
      </Pressable>
    </Modal>
  );

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.xl,
        paddingBottom: insets.bottom + Spacing.miniPlayerHeight + Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
      showsVerticalScrollIndicator={false}
    >
      <ThemedText type="h2">Your Analytics</ThemedText>
      <ThemedText
        type="small"
        style={{ color: theme.textSecondary, marginTop: Spacing.xs }}
      >
        See how you've been using PodBrief
      </ThemedText>

      <Pressable
        onPress={() => setFilterModalVisible(true)}
        style={[
          styles.filterPill,
          { backgroundColor: theme.backgroundSecondary },
        ]}
      >
        <ThemedText type="small">{DATE_RANGE_LABELS[dateRange]}</ThemedText>
        <Feather
          name="chevron-down"
          size={16}
          color={theme.textSecondary}
          style={{ marginLeft: Spacing.xs }}
        />
      </Pressable>

      {loading ? renderSkeleton() : null}
      {!loading && error ? renderError() : null}
      {!loading && !error && isEmpty ? renderEmpty() : null}
      {!loading && !error && data && !isEmpty ? (
        <>
          {renderSummaryCards()}
          {renderHorizontalBarChart()}
          {renderDonutChart()}
          {renderActivityChart()}
          {renderSummariesVsEpisodes()}
          {renderTimeSavedChart()}
        </>
      ) : null}

      {renderFilterModal()}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  filterPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  statCard: {
    width: "47%",
    flexGrow: 1,
    padding: Spacing.lg,
    gap: Spacing.xs,
  },
  statValue: {
    marginTop: Spacing.sm,
  },
  chartCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
  },
  chartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  chartArea: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  segmentedControl: {
    flexDirection: "row",
    borderRadius: BorderRadius.xs,
    overflow: "hidden",
  },
  segmentButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.xs,
  },
  donutContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: Spacing.md,
  },
  donutCenter: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  legendRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.lg,
    marginTop: Spacing.md,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  genreLegend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
  },
  genreLegendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  yAxisContainer: {
    width: 36,
    position: "relative",
  },
  yAxisLabel: {
    position: "absolute",
    left: 0,
    fontSize: 10,
    fontFamily: "GoogleSansFlex",
    width: 36,
    textAlign: "right",
  },
  xAxisContainer: {
    height: 20,
    position: "relative",
    marginBottom: Spacing.sm,
  },
  xAxisLabel: {
    position: "absolute",
    fontSize: 10,
    fontFamily: "GoogleSansFlex",
    width: 30,
    textAlign: "center",
  },
  skeletonCard: {
    width: "47%",
    flexGrow: 1,
    height: 100,
    borderRadius: BorderRadius.md,
  },
  skeletonChart: {
    width: "100%",
    height: 180,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["3xl"] * 2,
    gap: Spacing.lg,
  },
  emptyText: {
    textAlign: "center",
    paddingHorizontal: Spacing.xl,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.lg,
  },
  modalContainer: {
    width: "100%",
    maxWidth: 400,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
  },
  modalTitle: {
    marginBottom: Spacing.lg,
  },
  modalOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.xs,
  },
  customDateContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.md,
  },
  dateInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderRadius: BorderRadius.xs,
    paddingHorizontal: Spacing.md,
    fontSize: 14,
    fontFamily: "GoogleSansFlex",
  },
});