import React, { useState, useCallback } from "react";
import { View, StyleSheet, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useRoute, useNavigation } from "@react-navigation/native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import * as Sharing from "expo-sharing";
import * as Haptics from "expo-haptics";

import { SegmentedControl } from "@/components/SegmentedControl";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAudioPlayerContext } from "@/contexts/AudioPlayerContext";
import { UserBrief, AudioItem } from "@/lib/types";
import { Spacing, BorderRadius } from "@/constants/theme";
import { formatDuration } from "@/lib/utils";

const placeholderImage = require("../../assets/images/podcast-placeholder.png");

type ContentTab = "summary" | "condensed" | "transcript";

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
