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
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import { TaddyEpisode, SavedEpisode } from "@/lib/types";
import { formatDate, formatDuration } from "@/lib/utils";

const placeholderImage = require("../../assets/images/podcast-placeholder.png");

interface EpisodeCardProps {
  episode: TaddyEpisode | SavedEpisode;
  showPodcastName?: boolean;
  showDivider?: boolean;
  isSaved?: boolean;
  isSummarized?: boolean;
  onPress?: () => void;
  onPlayPress?: () => void;
  onSavePress?: () => void;
  onGenerateBriefPress?: () => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function EpisodeCard({
  episode,
  showPodcastName = true,
  showDivider = true,
  isSaved = false,
  isSummarized = false,
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
      <View style={styles.contentRow}>
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
      </View>
      {(onSavePress || onGenerateBriefPress) ? (
        <View style={styles.actionsRow}>
          {onSavePress ? (
            isSaved ? (
              <Pressable
                onPress={onSavePress}
                style={[styles.actionButton, { backgroundColor: theme.backgroundTertiary }]}
              >
                <Feather name="check" size={14} color={theme.text} />
                <ThemedText
                  type="caption"
                  style={{ color: theme.text, marginLeft: 4, fontWeight: "600" }}
                >
                  Added
                </ThemedText>
              </Pressable>
            ) : (
              <Pressable
                onPress={onSavePress}
                style={[styles.actionButton, { backgroundColor: theme.gold }]}
              >
                <Feather name="plus" size={14} color={theme.buttonText} />
                <ThemedText
                  type="caption"
                  style={{ color: theme.buttonText, marginLeft: 4, fontWeight: "600" }}
                >
                  Add Episode
                </ThemedText>
              </Pressable>
            )
          ) : null}
          {onGenerateBriefPress ? (
            isSummarized ? (
              <View style={[styles.completedBadge, { borderColor: theme.textTertiary }]}>
                <Feather name="check-circle" size={12} color={theme.textSecondary} />
                <ThemedText
                  type="caption"
                  style={{ color: theme.textSecondary, marginLeft: 4, fontWeight: "500" }}
                >
                  Summarized
                </ThemedText>
              </View>
            ) : (
              <Pressable
                onPress={onGenerateBriefPress}
                style={[styles.actionButton, { backgroundColor: theme.gold }]}
              >
                <Feather name="zap" size={14} color={theme.buttonText} />
                <ThemedText
                  type="caption"
                  style={{ color: theme.buttonText, marginLeft: 4, fontWeight: "600" }}
                >
                  Summarize
                </ThemedText>
              </Pressable>
            )
          ) : null}
        </View>
      ) : null}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: Spacing.md,
  },
  contentRow: {
    flexDirection: "row",
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
  completedBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    opacity: 0.7,
  },
  playButton: {
    padding: Spacing.sm,
  },
});
