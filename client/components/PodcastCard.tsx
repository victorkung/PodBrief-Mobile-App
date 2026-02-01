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
import { TaddyPodcast, FollowedPodcast } from "@/lib/types";

const placeholderImage = require("../../assets/images/podcast-placeholder.png");

interface PodcastCardProps {
  podcast: TaddyPodcast | FollowedPodcast;
  isFollowed?: boolean;
  onPress?: () => void;
  onFollowPress?: () => void;
  showDivider?: boolean;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function PodcastCard({
  podcast,
  isFollowed = false,
  onPress,
  onFollowPress,
  showDivider = true,
}: PodcastCardProps) {
  const { theme } = useTheme();
  const scale = useSharedValue(1);

  const isTaddyPodcast = "uuid" in podcast;
  const uuid = isTaddyPodcast ? podcast.uuid : podcast.taddy_podcast_uuid;
  const name = isTaddyPodcast ? podcast.name : podcast.podcast_name;
  const imageUrl = isTaddyPodcast ? podcast.imageUrl : podcast.podcast_image_url;
  const authorName = isTaddyPodcast ? podcast.authorName : podcast.author_name;
  const episodeCount = isTaddyPodcast
    ? podcast.totalEpisodesCount
    : podcast.total_episodes_count;

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
        <ThemedText
          type="caption"
          numberOfLines={1}
          style={[styles.meta, { color: theme.textSecondary }]}
        >
          {authorName || "Unknown"}
        </ThemedText>
        <ThemedText type="caption" style={{ color: theme.textSecondary }}>
          {episodeCount} episodes
        </ThemedText>
      </View>
      {onFollowPress ? (
        <Pressable
          onPress={onFollowPress}
          style={[
            styles.followButton,
            {
              backgroundColor: isFollowed
                ? theme.backgroundTertiary
                : theme.gold,
            },
          ]}
        >
          <Feather
            name={isFollowed ? "check" : "plus"}
            size={14}
            color={isFollowed ? theme.text : theme.buttonText}
          />
          <ThemedText
            type="caption"
            style={{
              color: isFollowed ? theme.text : theme.buttonText,
              fontWeight: "600",
              marginLeft: 4,
            }}
          >
            {isFollowed ? "Following" : "Follow"}
          </ThemedText>
        </Pressable>
      ) : null}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    paddingVertical: Spacing.md,
    alignItems: "center",
  },
  artwork: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.xs,
  },
  content: {
    flex: 1,
    marginLeft: Spacing.md,
    justifyContent: "center",
  },
  title: {
    fontWeight: "600",
    marginBottom: 2,
  },
  meta: {
    marginBottom: 2,
  },
  followButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
});
