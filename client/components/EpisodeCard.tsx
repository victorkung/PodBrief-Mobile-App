import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Image } from "expo-image";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { TaddyEpisode, SavedEpisode } from "@/lib/types";

const placeholderImage = require("../../assets/images/podcast-placeholder.png");

interface EpisodeCardProps {
  episode: TaddyEpisode | SavedEpisode;
  showPodcastName?: boolean;
  showDivider?: boolean;
  onPress?: () => void;
  onPlayPress?: () => void;
  onSavePress?: () => void;
  onGenerateBriefPress?: () => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function formatDate(date: number | string | null): string {
  if (!date) return "";
  const d = typeof date === "number" ? new Date(date) : new Date(date);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function EpisodeCard({
  episode,
  showPodcastName = true,
  showDivider = true,
  onPress,
  onPlayPress,
  onSavePress,
  onGenerateBriefPress,
}: EpisodeCardProps) {
  const { theme } = useTheme();
  const scale = useSharedValue(1);

  const isTaddyEpisode = "uuid" in episode;
  const name = isTaddyEpisode ? episode.name : episode.episode_name;
  const imageUrl = isTaddyEpisode
    ? episode.imageUrl || episode.podcastSeries?.imageUrl
    : episode.episode_thumbnail;
  const podcastName = isTaddyEpisode
    ? episode.podcastSeries?.name
    : episode.podcast_name;
  const duration = isTaddyEpisode
    ? episode.duration
    : episode.episode_duration_seconds || 0;
  const publishedAt = isTaddyEpisode
    ? episode.datePublished
    : episode.episode_published_at;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => (scale.value = withSpring(0.98))}
      onPressOut={() => (scale.value = withSpring(1))}
      style={[
        styles.container,
        showDivider && { borderBottomWidth: 1, borderBottomColor: "#394256" },
        animatedStyle,
      ]}
    >
      <Image
        source={imageUrl ? { uri: imageUrl } : placeholderImage}
        style={styles.artwork}
        contentFit="cover"
        transition={200}
      />
      <View style={styles.content}>
        <ThemedText
          type="small"
          numberOfLines={2}
          style={[styles.title, { color: "#FFFFFF" }]}
        >
          {name}
        </ThemedText>
        {showPodcastName && podcastName ? (
          <ThemedText
            type="caption"
            numberOfLines={1}
            style={[styles.podcast, { color: theme.textSecondary }]}
          >
            {podcastName}
          </ThemedText>
        ) : null}
        <View style={styles.metaRow}>
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
            {formatDate(publishedAt)}
          </ThemedText>
          <View style={[styles.dot, { backgroundColor: theme.textTertiary }]} />
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
            {formatDuration(duration)}
          </ThemedText>
        </View>
      </View>
      {onPlayPress && !onSavePress && !onGenerateBriefPress ? (
        <Pressable onPress={onPlayPress} style={styles.playButton}>
          <Feather name="play" size={16} color={theme.gold} />
        </Pressable>
      ) : null}
      {(onSavePress || onGenerateBriefPress) ? (
        <View style={styles.actionsRow}>
          {onSavePress ? (
            <Pressable
              onPress={onSavePress}
              style={[styles.actionButton, { backgroundColor: theme.backgroundTertiary }]}
            >
              <Feather name="plus" size={14} color={theme.text} />
              <ThemedText
                type="caption"
                style={{ color: theme.text, marginLeft: 4, fontWeight: "500" }}
              >
                Add Episode
              </ThemedText>
            </Pressable>
          ) : null}
          {onGenerateBriefPress ? (
            <Pressable
              onPress={onGenerateBriefPress}
              style={[styles.actionButton, { backgroundColor: theme.backgroundTertiary }]}
            >
              <Feather name="zap" size={14} color={theme.gold} />
              <ThemedText
                type="caption"
                style={{ color: theme.text, marginLeft: 4, fontWeight: "500" }}
              >
                Summarize
              </ThemedText>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingVertical: Spacing.md,
    alignItems: "flex-start",
  },
  artwork: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.xs,
  },
  content: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  title: {
    fontWeight: "600",
    marginBottom: 2,
  },
  podcast: {
    marginBottom: 2,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    marginHorizontal: 6,
  },
  actionsRow: {
    flexDirection: "row",
    width: "100%",
    marginTop: Spacing.sm,
    gap: Spacing.sm,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  playButton: {
    padding: Spacing.sm,
  },
});
