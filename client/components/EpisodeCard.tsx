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
        { backgroundColor: theme.backgroundDefault },
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
        <ThemedText type="h4" numberOfLines={2} style={styles.title}>
          {name}
        </ThemedText>
        {showPodcastName && podcastName ? (
          <ThemedText type="small" numberOfLines={1} style={styles.podcast}>
            {podcastName}
          </ThemedText>
        ) : null}
        <View style={styles.metaRow}>
          <ThemedText type="caption" style={{ color: theme.textTertiary }}>
            {formatDate(publishedAt)}
          </ThemedText>
          <View style={styles.dot} />
          <ThemedText type="caption" style={{ color: theme.textTertiary }}>
            {formatDuration(duration)}
          </ThemedText>
        </View>
      </View>
      <View style={styles.actions}>
        {onPlayPress ? (
          <Pressable onPress={onPlayPress} style={styles.actionButton}>
            <Feather name="play" size={18} color={theme.gold} />
          </Pressable>
        ) : null}
        {onSavePress ? (
          <Pressable onPress={onSavePress} style={styles.actionButton}>
            <Feather name="bookmark" size={18} color={theme.textSecondary} />
          </Pressable>
        ) : null}
        {onGenerateBriefPress ? (
          <Pressable
            onPress={onGenerateBriefPress}
            style={[styles.briefButton, { backgroundColor: theme.gold }]}
          >
            <Feather name="zap" size={14} color={theme.buttonText} />
          </Pressable>
        ) : null}
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  artwork: {
    width: Spacing.artworkSm,
    height: Spacing.artworkSm,
    borderRadius: BorderRadius.xs,
  },
  content: {
    flex: 1,
    marginLeft: Spacing.md,
    justifyContent: "center",
  },
  title: {
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
    backgroundColor: "#6B7280",
    marginHorizontal: 6,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  actionButton: {
    padding: Spacing.sm,
  },
  briefButton: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
});
