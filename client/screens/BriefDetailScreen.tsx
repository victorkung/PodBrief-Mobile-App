import React, { useState, useCallback, useEffect } from "react";
import { View, StyleSheet, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useRoute, useNavigation } from "@react-navigation/native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import * as Sharing from "expo-sharing";
import * as Haptics from "expo-haptics";
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withRepeat, 
  withTiming,
  withSequence,
  Easing 
} from "react-native-reanimated";
import { useQueryClient } from "@tanstack/react-query";

import { SegmentedControl } from "@/components/SegmentedControl";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAudioPlayerContext } from "@/contexts/AudioPlayerContext";
import { UserBrief, AudioItem } from "@/lib/types";
import { Spacing, BorderRadius } from "@/constants/theme";
import { formatDuration } from "@/lib/utils";

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

  const brief = (route.params as any)?.brief as UserBrief;
  const masterBrief = brief?.master_brief;

  const [selectedTab, setSelectedTab] = useState<ContentTab>("summary");

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

  const segments = [
    { key: "summary" as ContentTab, label: "Summary" },
    { key: "condensed" as ContentTab, label: "Condensed" },
    { key: "transcript" as ContentTab, label: "Transcript" },
  ];

  const getContent = () => {
    switch (selectedTab) {
      case "summary":
        return masterBrief?.summary_text || "Summary not available";
      case "condensed":
        return masterBrief?.ai_condensed_transcript || "Condensed transcript not available";
      case "transcript":
        return masterBrief?.transcript_content || "Full transcript not available";
      default:
        return "";
    }
  };

  const isProcessing =
    masterBrief?.pipeline_status !== "completed" &&
    masterBrief?.pipeline_status !== "failed";

  const audioDuration = masterBrief?.audio_duration_seconds || 0;

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <ScrollView
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
              <ThemedText type="caption" style={[styles.contentMeta, { color: theme.textTertiary }]}>
                {selectedTab === "summary" ? "AI-generated summary" : null}
                {selectedTab === "condensed" ? "AI-condensed transcript" : null}
                {selectedTab === "transcript" ? "Full episode transcript" : null}
              </ThemedText>
              <ThemedText type="body" style={styles.contentText}>
                {getContent()}
              </ThemedText>
            </View>
          </>
        )}
      </ScrollView>
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
  contentMeta: {
    marginBottom: Spacing.md,
  },
  contentText: {
    lineHeight: 26,
  },
});
