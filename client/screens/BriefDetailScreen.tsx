import React, { useState, useCallback, useEffect, useRef } from "react";
import { View, StyleSheet, ScrollView, Pressable, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useRoute } from "@react-navigation/native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import { useQuery } from "@tanstack/react-query";
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withRepeat, 
  withTiming,
  withSequence,
  Easing 
} from "react-native-reanimated";
import Markdown from "react-native-markdown-display";

import { Card } from "@/components/Card";
import { SegmentedControl } from "@/components/SegmentedControl";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { UserBrief, MasterBrief } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { Spacing, BorderRadius } from "@/constants/theme";
import { formatDuration, formatDateLong, getLanguageLabel, calculateReadingTime, getWordCount } from "@/lib/utils";

const placeholderImage = require("../../assets/images/podcast-placeholder.png");

type ContentTab = "summary" | "transcript";

const PIPELINE_STATUS_MESSAGES: Record<string, { title: string; subtitle: string; icon: string }> = {
  pending: {
    title: "Starting Generation",
    subtitle: "Your AI summary is queued and will begin shortly...",
    icon: "clock",
  },
  transcribing: {
    title: "Transcribing Audio",
    subtitle: "Converting speech to text using advanced AI...",
    icon: "mic",
  },
  summarizing: {
    title: "Analyzing Content",
    subtitle: "Our AI is reading and understanding the key points...",
    icon: "cpu",
  },
  generating_audio: {
    title: "Creating Narration",
    subtitle: "Generating natural-sounding audio summary...",
    icon: "volume-2",
  },
  processing: {
    title: "Processing",
    subtitle: "Your AI summary is being generated...",
    icon: "loader",
  },
};

function SkeletonLine({ width, height = 16, style }: { width: string | number; height?: number; style?: any }) {
  const { theme } = useTheme();
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.3, { duration: 800, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          backgroundColor: theme.backgroundSecondary,
          borderRadius: 4,
        },
        animatedStyle,
        style,
      ]}
    />
  );
}

function ProcessingSkeleton({ pipelineStatus, theme }: { pipelineStatus: string; theme: any }) {
  const statusInfo = PIPELINE_STATUS_MESSAGES[pipelineStatus] || PIPELINE_STATUS_MESSAGES.processing;
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 2000, easing: Easing.linear }),
      -1,
      false
    );
  }, []);

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <View style={skeletonStyles.container}>
      <View style={[skeletonStyles.statusCard, { backgroundColor: theme.backgroundSecondary }]}>
        <Animated.View style={pipelineStatus === "processing" ? spinStyle : undefined}>
          <Feather name={statusInfo.icon as any} size={32} color={theme.gold} />
        </Animated.View>
        <ThemedText type="h3" style={skeletonStyles.statusTitle}>
          {statusInfo.title}
        </ThemedText>
        <ThemedText type="body" style={[skeletonStyles.statusSubtitle, { color: theme.textSecondary }]}>
          {statusInfo.subtitle}
        </ThemedText>
        
        <View style={skeletonStyles.progressBar}>
          <View style={[skeletonStyles.progressTrack, { backgroundColor: theme.backgroundRoot }]}>
            <Animated.View 
              style={[
                skeletonStyles.progressFill, 
                { backgroundColor: theme.gold }
              ]} 
            />
          </View>
        </View>
      </View>

      <View style={skeletonStyles.previewSection}>
        <ThemedText type="small" style={{ color: theme.textTertiary, marginBottom: Spacing.md }}>
          Preview of what's coming...
        </ThemedText>
        
        <View style={[skeletonStyles.skeletonCard, { backgroundColor: theme.backgroundDefault }]}>
          <SkeletonLine width="90%" height={14} />
          <SkeletonLine width="100%" height={14} style={{ marginTop: 12 }} />
          <SkeletonLine width="85%" height={14} style={{ marginTop: 12 }} />
          <SkeletonLine width="95%" height={14} style={{ marginTop: 12 }} />
          <SkeletonLine width="70%" height={14} style={{ marginTop: 12 }} />
        </View>
      </View>

      <View style={skeletonStyles.tipSection}>
        <Feather name="info" size={16} color={theme.textTertiary} />
        <ThemedText type="caption" style={[skeletonStyles.tipText, { color: theme.textTertiary }]}>
          This usually takes 2-3 minutes. Feel free to browse other content while we work on your summary.
        </ThemedText>
      </View>
    </View>
  );
}

const skeletonStyles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Spacing.lg,
  },
  statusCard: {
    alignItems: "center",
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.xl,
  },
  statusTitle: {
    marginTop: Spacing.md,
    textAlign: "center",
  },
  statusSubtitle: {
    textAlign: "center",
    marginTop: Spacing.xs,
  },
  progressBar: {
    width: "100%",
    marginTop: Spacing.lg,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    width: "60%",
    borderRadius: 2,
  },
  previewSection: {
    marginBottom: Spacing.xl,
  },
  skeletonCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
  },
  tipSection: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  tipText: {
    flex: 1,
    lineHeight: 20,
  },
});

function formatAudioDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

export default function BriefDetailScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const route = useRoute();
  const scrollViewRef = useRef<ScrollView>(null);

  const paramBrief = (route.params as any)?.brief as UserBrief;
  const masterBriefId = paramBrief?.master_brief_id;

  const { data: fetchedBrief } = useQuery({
    queryKey: ["briefDetail", masterBriefId],
    queryFn: async () => {
      if (!masterBriefId) return null;
      const { data, error } = await supabase
        .from("master_briefs")
        .select(
          `
          *,
          brief_transcripts(transcript_content, ai_condensed_transcript),
          brief_pipeline_state(pipeline_status, pipeline_error, summary_phase, audio_status, audio_error)
        `
        )
        .eq("id", masterBriefId)
        .single();
      if (error) throw error;
      const result = data as any;
      if (Array.isArray(result.brief_transcripts)) {
        result.brief_transcripts = result.brief_transcripts[0] || null;
      }
      if (Array.isArray(result.brief_pipeline_state)) {
        result.brief_pipeline_state = result.brief_pipeline_state[0] || null;
      }
      return result as MasterBrief;
    },
    enabled: !!masterBriefId,
  });

  const masterBrief = fetchedBrief || paramBrief?.master_brief;
  const brief = paramBrief;

  const [selectedTab, setSelectedTab] = useState<ContentTab>("summary");
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const handleCopyContent = useCallback(async () => {
    const content = getContent();
    if (content) {
      await Clipboard.setStringAsync(content);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setCopiedSection(selectedTab);
      setTimeout(() => setCopiedSection(null), 2000);
    }
  }, [selectedTab]);

  const handleScrollToTop = useCallback(() => {
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleScroll = useCallback((event: any) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    setShowScrollTop(offsetY > 400);
  }, []);

  const segments = [
    { key: "summary" as ContentTab, label: "Summary" },
    { key: "transcript" as ContentTab, label: "Transcript" },
  ];

  const getContent = (): string => {
    switch (selectedTab) {
      case "summary":
        return masterBrief?.summary_text || "";
      case "transcript":
        return masterBrief?.brief_transcripts?.transcript_content || "";
      default:
        return "";
    }
  };

  const getSectionDescription = (): string => {
    switch (selectedTab) {
      case "summary":
        return "An AI-generated summary of the episode structured into thematic chapters, consisting of the most important takeaways";
      case "transcript":
        return "The raw, unedited transcript generated from the episode.";
      default:
        return "";
    }
  };

  const getCopyButtonLabel = (): string => {
    switch (selectedTab) {
      case "summary":
        return "Copy Summary";
      case "transcript":
        return "Copy Transcript";
      default:
        return "Copy";
    }
  };

  const getContentMetadata = () => {
    const content = getContent();
    if (!content) return null;
    
    const wordCount = getWordCount(content);
    const readingTime = calculateReadingTime(content);
    const language = getLanguageLabel(masterBrief?.language);
    
    return { wordCount, readingTime, language };
  };

  const isProcessing =
    masterBrief?.pipeline_status !== "completed" &&
    masterBrief?.pipeline_status !== "failed";

  const audioDuration = masterBrief?.audio_duration_seconds || 0;

  const contentMetadata = getContentMetadata();
  const content = getContent();

  const markdownStyles = {
    body: {
      color: theme.text,
      fontSize: 14,
      lineHeight: 22,
    },
    heading1: {
      color: theme.text,
      fontSize: 18,
      fontWeight: "700" as const,
      marginTop: Spacing.lg,
      marginBottom: Spacing.sm,
    },
    heading2: {
      color: theme.text,
      fontSize: 16,
      fontWeight: "600" as const,
      marginTop: Spacing.md,
      marginBottom: Spacing.xs,
    },
    heading3: {
      color: theme.text,
      fontSize: 15,
      fontWeight: "600" as const,
      marginTop: Spacing.sm,
      marginBottom: Spacing.xs,
    },
    paragraph: {
      color: theme.text,
      fontSize: 14,
      lineHeight: 22,
      marginBottom: Spacing.sm,
    },
    list_item: {
      color: theme.text,
      fontSize: 14,
      lineHeight: 22,
    },
    bullet_list: {
      marginBottom: Spacing.sm,
    },
    ordered_list: {
      marginBottom: Spacing.sm,
    },
    strong: {
      fontWeight: "600" as const,
    },
    em: {
      fontStyle: "italic" as const,
    },
    blockquote: {
      backgroundColor: theme.backgroundSecondary,
      borderLeftColor: theme.gold,
      borderLeftWidth: 3,
      paddingLeft: Spacing.md,
      paddingVertical: Spacing.sm,
      marginVertical: Spacing.sm,
    },
    code_inline: {
      backgroundColor: theme.backgroundSecondary,
      color: theme.gold,
      paddingHorizontal: 4,
      borderRadius: 4,
    },
    link: {
      color: theme.gold,
    },
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <ScrollView
        ref={scrollViewRef}
        onScroll={handleScroll}
        scrollEventThrottle={100}
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.md,
          paddingBottom: insets.bottom + Spacing.miniPlayerHeight + Spacing.xl,
          paddingHorizontal: Spacing.md,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Image
            source={
              masterBrief?.episode_thumbnail
                ? { uri: masterBrief.episode_thumbnail }
                : placeholderImage
            }
            style={styles.artwork}
            contentFit="cover"
            transition={200}
          />
          <View style={styles.headerInfo}>
            <ThemedText type="h3" numberOfLines={3} style={styles.title}>
              {masterBrief?.episode_name || "Brief"}
            </ThemedText>
            <ThemedText type="caption" numberOfLines={1} style={{ color: theme.gold, marginBottom: Spacing.xs }}>
              {masterBrief?.podcast_name}
            </ThemedText>
            {masterBrief?.episode_published_at ? (
              <View style={styles.metaRow}>
                <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                  Original Episode: {formatDateLong(masterBrief.episode_published_at)}
                </ThemedText>
                {masterBrief.total_duration_minutes ? (
                  <>
                    <View style={[styles.dot, { backgroundColor: theme.textTertiary }]} />
                    <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                      {formatDuration(masterBrief.total_duration_minutes * 60)}
                    </ThemedText>
                  </>
                ) : null}
              </View>
            ) : null}
            {brief?.created_at ? (
              <View style={styles.metaRow}>
                <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                  Summary: {formatDateLong(brief.created_at)}
                </ThemedText>
                {audioDuration > 0 ? (
                  <>
                    <View style={[styles.dot, { backgroundColor: theme.textTertiary }]} />
                    <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                      {formatDuration(audioDuration)}
                    </ThemedText>
                  </>
                ) : null}
                {masterBrief?.language ? (
                  <>
                    <View style={[styles.dot, { backgroundColor: theme.textTertiary }]} />
                    <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                      {getLanguageLabel(masterBrief.language)}
                    </ThemedText>
                  </>
                ) : null}
              </View>
            ) : null}
          </View>
        </View>

        {(() => {
          if (isProcessing || !masterBrief?.total_duration_minutes || !audioDuration) return null;
          const summaryDurationMinutes = Math.round(audioDuration / 60);
          const timeSavedMinutes = masterBrief.total_duration_minutes - summaryDurationMinutes;
          if (timeSavedMinutes <= 0) return null;
          return (
            <Card style={styles.timeSavedBanner}>
              <View style={styles.timeSavedRow}>
                <View style={[styles.iconCircle, { backgroundColor: theme.gold }]}>
                  <Feather name="zap" size={20} color={theme.buttonText} />
                </View>
                <ThemedText type="body" style={styles.timeSavedText}>
                  This summary helped save you ~{timeSavedMinutes} minutes
                </ThemedText>
              </View>
            </Card>
          );
        })()}

        {isProcessing ? (
          <ProcessingSkeleton 
            pipelineStatus={masterBrief?.pipeline_status || "processing"} 
            theme={theme} 
          />
        ) : (
          <>
            <SegmentedControl
              segments={segments}
              selectedKey={selectedTab}
              onSelect={setSelectedTab}
            />

            <View style={styles.sectionHeader}>
              <ThemedText type="body" style={[styles.sectionDescription, { color: theme.textSecondary }]}>
                {getSectionDescription()}
              </ThemedText>
              {contentMetadata ? (
                <ThemedText type="body" style={[styles.metadataText, { color: theme.textSecondary }]}>
                  {contentMetadata.readingTime} min read • {contentMetadata.wordCount.toLocaleString()} words{selectedTab !== "transcript" ? ` • ${contentMetadata.language}` : ""}
                </ThemedText>
              ) : null}
              
              <Pressable 
                onPress={handleCopyContent}
                style={[styles.copyButton, { backgroundColor: theme.backgroundTertiary }]}
              >
                <Feather 
                  name={copiedSection === selectedTab ? "check" : "copy"} 
                  size={14} 
                  color={copiedSection === selectedTab ? theme.gold : theme.text} 
                />
                <ThemedText 
                  type="caption" 
                  style={{ 
                    color: copiedSection === selectedTab ? theme.gold : theme.text,
                    marginLeft: 4,
                    fontWeight: "600"
                  }}
                >
                  {copiedSection === selectedTab ? "Copied!" : getCopyButtonLabel()}
                </ThemedText>
              </Pressable>
            </View>
              
            {content ? (
              <View style={styles.contentSection}>
                <Markdown style={markdownStyles}>{content}</Markdown>
              </View>
            ) : (
              <ThemedText type="body" style={{ color: theme.textTertiary, marginTop: Spacing.lg }}>
                {selectedTab === "summary" ? "Summary not available" : null}
                {selectedTab === "transcript" ? "Full transcript not available" : null}
              </ThemedText>
            )}
          </>
        )}
      </ScrollView>

      {showScrollTop ? (
        <Pressable
          onPress={handleScrollToTop}
          style={[styles.scrollTopButton, { 
            backgroundColor: theme.gold,
            bottom: 20
          }]}
        >
          <Feather name="arrow-up" size={20} color={theme.buttonText} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    marginTop: 10,
    marginBottom: Spacing.lg + 5,
  },
  artwork: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.md,
  },
  headerInfo: {
    flex: 1,
    marginLeft: Spacing.sm,
  },
  title: {
    marginVertical: Spacing.xs,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginTop: 2,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
  },
  timeSavedBanner: {
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  timeSavedRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  timeSavedText: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  sectionHeader: {
    marginTop: Spacing.md,
    marginBottom: Spacing.md,
  },
  sectionDescription: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: Spacing.xs,
  },
  metadataText: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: Spacing.md,
  },
  copyButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 999,
    marginTop: Spacing.sm,
  },
  contentSection: {
    marginTop: Spacing.sm,
  },
  scrollTopButton: {
    position: "absolute",
    right: Spacing.md,
    bottom: 0,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
});
