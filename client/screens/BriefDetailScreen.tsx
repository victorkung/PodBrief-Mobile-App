import React, { useState, useCallback, useEffect, useRef } from "react";
import { View, StyleSheet, ScrollView, Pressable, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useRoute, useNavigation } from "@react-navigation/native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import * as Sharing from "expo-sharing";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withRepeat, 
  withTiming,
  withSequence,
  Easing 
} from "react-native-reanimated";
import { useQueryClient } from "@tanstack/react-query";
import Markdown from "react-native-markdown-display";

import { SegmentedControl } from "@/components/SegmentedControl";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAudioPlayerContext } from "@/contexts/AudioPlayerContext";
import { UserBrief, AudioItem } from "@/lib/types";
import { Spacing, BorderRadius } from "@/constants/theme";
import { formatDuration, getLanguageLabel, calculateReadingTime, getWordCount } from "@/lib/utils";

const placeholderImage = require("../../assets/images/podcast-placeholder.png");

type ContentTab = "summary" | "condensed" | "transcript";

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
  const navigation = useNavigation();
  const route = useRoute();
  const { play } = useAudioPlayerContext();
  const scrollViewRef = useRef<ScrollView>(null);

  const brief = (route.params as any)?.brief as UserBrief;
  const masterBrief = brief?.master_brief;

  const [selectedTab, setSelectedTab] = useState<ContentTab>("summary");
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const handlePlay = useCallback(() => {
    if (!masterBrief || masterBrief.pipeline_status !== "completed") return;

    const audioItem: AudioItem = {
      id: brief.id,
      type: "summary",
      title: masterBrief.episode_name || "Summary",
      podcast: masterBrief.podcast_name || "",
      artwork: masterBrief.episode_thumbnail,
      audioUrl: masterBrief.audio_url || "",
      duration: (masterBrief.audio_duration_seconds || 0) * 1000,
      progress: brief.audio_progress_seconds * 1000,
      masterBriefId: brief.master_brief_id,
      userBriefId: brief.id,
    };
    play(audioItem);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [brief, masterBrief, play]);

  const handleShare = useCallback(async () => {
    const shareUrl = `https://podbrief.io/brief/${brief.slug}`;
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(shareUrl);
    }
  }, [brief]);

  const handleDownload = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const handleMarkComplete = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

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
    { key: "condensed" as ContentTab, label: "Condensed" },
    { key: "transcript" as ContentTab, label: "Transcript" },
  ];

  const getContent = (): string => {
    switch (selectedTab) {
      case "summary":
        return masterBrief?.summary_text || "";
      case "condensed":
        return masterBrief?.ai_condensed_transcript || "";
      case "transcript":
        return masterBrief?.transcript_content || "";
      default:
        return "";
    }
  };

  const getSectionTitle = (): string => {
    switch (selectedTab) {
      case "summary":
        return "AI-Generated Summary";
      case "condensed":
        return "Condensed Transcript";
      case "transcript":
        return "Full Episode Transcript";
      default:
        return "";
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
      fontSize: 16,
      lineHeight: 26,
    },
    heading1: {
      color: theme.text,
      fontSize: 24,
      fontWeight: "700" as const,
      marginTop: Spacing.lg,
      marginBottom: Spacing.sm,
    },
    heading2: {
      color: theme.text,
      fontSize: 20,
      fontWeight: "600" as const,
      marginTop: Spacing.lg,
      marginBottom: Spacing.sm,
    },
    heading3: {
      color: theme.text,
      fontSize: 18,
      fontWeight: "600" as const,
      marginTop: Spacing.md,
      marginBottom: Spacing.xs,
    },
    paragraph: {
      color: theme.text,
      fontSize: 16,
      lineHeight: 26,
      marginBottom: Spacing.md,
    },
    list_item: {
      color: theme.text,
      fontSize: 16,
      lineHeight: 24,
    },
    bullet_list: {
      marginBottom: Spacing.md,
    },
    ordered_list: {
      marginBottom: Spacing.md,
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
      marginVertical: Spacing.md,
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
          paddingTop: headerHeight + Spacing.lg,
          paddingBottom: insets.bottom + Spacing.miniPlayerHeight + Spacing.xl,
          paddingHorizontal: Spacing.lg,
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
            <ThemedText type="caption" numberOfLines={1} style={{ color: theme.textSecondary }}>
              {masterBrief?.podcast_name}
            </ThemedText>
            <ThemedText type="h3" numberOfLines={3} style={styles.title}>
              {masterBrief?.episode_name || "Brief"}
            </ThemedText>
            <View style={styles.metaRow}>
              <Feather name="clock" size={12} color={theme.gold} />
              <ThemedText type="caption" style={{ color: theme.gold, marginLeft: 4 }}>
                {formatAudioDuration(audioDuration)} summary
              </ThemedText>
            </View>
          </View>
        </View>

        <View style={styles.actionsSection}>
          <View style={styles.actionsGrid}>
            <Pressable
              onPress={handlePlay}
              disabled={isProcessing}
              style={[styles.gridButton, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}
            >
              <Feather name={isProcessing ? "loader" : "play"} size={18} color={theme.text} />
              <ThemedText type="small" style={{ color: theme.text, marginLeft: Spacing.sm, fontWeight: "500" }}>
                {isProcessing ? "Processing..." : `Play (${formatAudioDuration(audioDuration)})`}
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={handleShare}
              style={[styles.gridButton, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}
            >
              <Feather name="share-2" size={18} color={theme.text} />
              <ThemedText type="small" style={{ color: theme.text, marginLeft: Spacing.sm, fontWeight: "500" }}>
                Share
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={handleMarkComplete}
              style={[styles.gridButton, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}
            >
              <Feather name="check" size={18} color={theme.text} />
              <ThemedText type="small" style={{ color: theme.text, marginLeft: Spacing.sm, fontWeight: "500" }}>
                Mark Complete
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={handleDownload}
              style={[styles.gridButton, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}
            >
              <Feather name="download" size={18} color={theme.text} />
              <ThemedText type="small" style={{ color: theme.text, marginLeft: Spacing.sm, fontWeight: "500" }}>
                Download
              </ThemedText>
            </Pressable>
          </View>
        </View>

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

            <View
              style={[styles.contentCard, { backgroundColor: theme.backgroundDefault }]}
            >
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleRow}>
                  <ThemedText type="h4" style={{ color: theme.text }}>
                    {getSectionTitle()}
                  </ThemedText>
                  <Pressable 
                    onPress={handleCopyContent}
                    style={[styles.copyButton, { backgroundColor: theme.backgroundSecondary }]}
                  >
                    <Feather 
                      name={copiedSection === selectedTab ? "check" : "copy"} 
                      size={16} 
                      color={copiedSection === selectedTab ? theme.gold : theme.textSecondary} 
                    />
                    <ThemedText 
                      type="caption" 
                      style={{ 
                        color: copiedSection === selectedTab ? theme.gold : theme.textSecondary,
                        marginLeft: 6 
                      }}
                    >
                      {copiedSection === selectedTab ? "Copied" : "Copy"}
                    </ThemedText>
                  </Pressable>
                </View>
                {contentMetadata ? (
                  <View style={styles.metadataRow}>
                    <ThemedText type="caption" style={{ color: theme.textTertiary }}>
                      {contentMetadata.wordCount.toLocaleString()} words
                    </ThemedText>
                    <View style={[styles.metaDot, { backgroundColor: theme.textTertiary }]} />
                    <ThemedText type="caption" style={{ color: theme.textTertiary }}>
                      {contentMetadata.readingTime} min read
                    </ThemedText>
                    <View style={[styles.metaDot, { backgroundColor: theme.textTertiary }]} />
                    <ThemedText type="caption" style={{ color: theme.textTertiary }}>
                      {contentMetadata.language}
                    </ThemedText>
                  </View>
                ) : null}
              </View>
              
              {content ? (
                selectedTab === "summary" ? (
                  <Markdown style={markdownStyles}>{content}</Markdown>
                ) : (
                  <ThemedText type="body" style={styles.contentText}>
                    {content}
                  </ThemedText>
                )
              ) : (
                <ThemedText type="body" style={{ color: theme.textTertiary }}>
                  {selectedTab === "summary" ? "Summary not available" : null}
                  {selectedTab === "condensed" ? "Condensed transcript not available" : null}
                  {selectedTab === "transcript" ? "Full transcript not available" : null}
                </ThemedText>
              )}
            </View>
          </>
        )}
      </ScrollView>

      {showScrollTop ? (
        <Pressable
          onPress={handleScrollToTop}
          style={[styles.scrollTopButton, { 
            backgroundColor: theme.gold,
            bottom: insets.bottom + Spacing.miniPlayerHeight + Spacing.lg 
          }]}
        >
          <Feather name="chevron-up" size={24} color={theme.buttonText} />
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
    marginBottom: Spacing.lg,
  },
  artwork: {
    width: 100,
    height: 100,
    borderRadius: BorderRadius.md,
  },
  headerInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  title: {
    marginVertical: Spacing.xs,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  actionsSection: {
    marginBottom: Spacing.lg,
  },
  actionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  gridButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    width: "48.5%",
  },
  contentCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.lg,
  },
  sectionHeader: {
    marginBottom: Spacing.lg,
  },
  sectionTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  copyButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  metadataRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    marginHorizontal: Spacing.xs,
  },
  contentMeta: {
    marginBottom: Spacing.md,
  },
  contentText: {
    lineHeight: 26,
  },
  scrollTopButton: {
    position: "absolute",
    right: Spacing.lg,
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
});
