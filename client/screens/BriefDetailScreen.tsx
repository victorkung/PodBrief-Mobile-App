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
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { useAudioPlayerContext } from "@/contexts/AudioPlayerContext";
import { UserBrief, AudioItem } from "@/lib/types";
import { Spacing, BorderRadius } from "@/constants/theme";

const placeholderImage = require("../../assets/images/podcast-placeholder.png");

type ContentTab = "summary" | "condensed" | "transcript";

function formatDuration(seconds: number): string {
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

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.xl,
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
          <ThemedText type="h2" style={styles.title}>
            {masterBrief?.episode_name || "Brief"}
          </ThemedText>
          <ThemedText type="small" style={styles.podcast}>
            {masterBrief?.podcast_name}
          </ThemedText>
          {masterBrief?.audio_duration_seconds ? (
            <View style={styles.durationRow}>
              <Feather name="clock" size={14} color={theme.gold} />
              <ThemedText type="caption" style={{ color: theme.gold, marginLeft: 4 }}>
                {formatDuration(masterBrief.audio_duration_seconds)} summary
              </ThemedText>
            </View>
          ) : null}
        </View>

        <View style={styles.actions}>
          <Button
            onPress={handlePlay}
            disabled={isProcessing}
            style={styles.playButton}
          >
            <View style={styles.buttonContent}>
              <Feather
                name={isProcessing ? "loader" : "play"}
                size={18}
                color={theme.buttonText}
              />
              <ThemedText
                type="body"
                style={{ color: theme.buttonText, fontWeight: "600", marginLeft: 8 }}
              >
                {isProcessing ? "Processing..." : "Play"}
              </ThemedText>
            </View>
          </Button>
          <Pressable
            onPress={handleShare}
            style={[styles.iconButton, { backgroundColor: theme.backgroundSecondary }]}
          >
            <Feather name="share" size={20} color={theme.text} />
          </Pressable>
          <Pressable
            style={[styles.iconButton, { backgroundColor: theme.backgroundSecondary }]}
          >
            <Feather name="download" size={20} color={theme.text} />
          </Pressable>
        </View>

        <SegmentedControl
          segments={segments}
          selectedKey={selectedTab}
          onSelect={setSelectedTab}
        />

        <View
          style={[styles.contentCard, { backgroundColor: theme.backgroundDefault }]}
        >
          <ThemedText type="caption" style={styles.contentMeta}>
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
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  artwork: {
    width: Spacing.artworkXl,
    height: Spacing.artworkXl,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  title: {
    textAlign: "center",
    marginBottom: Spacing.xs,
  },
  podcast: {
    marginBottom: Spacing.sm,
    opacity: 0.7,
  },
  durationRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.xl,
    gap: Spacing.md,
  },
  playButton: {
    flex: 1,
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  iconButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  contentCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.lg,
  },
  contentMeta: {
    marginBottom: Spacing.md,
    opacity: 0.6,
  },
  contentText: {
    lineHeight: 26,
  },
});
