import React, { useEffect } from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolate,
} from "react-native-reanimated";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, Spacing } from "@/constants/theme";

interface SkeletonLoaderProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function SkeletonLoader({
  width = "100%",
  height = 16,
  borderRadius = BorderRadius.sm,
  style,
}: SkeletonLoaderProps) {
  const { theme } = useTheme();
  const shimmer = useSharedValue(0);

  useEffect(() => {
    shimmer.value = withRepeat(withTiming(1, { duration: 1200 }), -1, true);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shimmer.value, [0, 1], [0.3, 0.7]),
  }));

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          borderRadius,
          backgroundColor: theme.backgroundSecondary,
        },
        animatedStyle,
        style,
      ]}
    />
  );
}

export function PodcastCardSkeleton() {
  return (
    <View style={styles.podcastCard}>
      <SkeletonLoader width={64} height={64} borderRadius={BorderRadius.sm} />
      <View style={styles.podcastContent}>
        <SkeletonLoader width="80%" height={18} />
        <SkeletonLoader width="50%" height={14} style={{ marginTop: 6 }} />
        <SkeletonLoader width="30%" height={12} style={{ marginTop: 6 }} />
      </View>
    </View>
  );
}

export function EpisodeCardSkeleton() {
  return (
    <View style={styles.episodeCard}>
      <SkeletonLoader width={48} height={48} borderRadius={BorderRadius.xs} />
      <View style={styles.episodeContent}>
        <SkeletonLoader width="90%" height={16} />
        <SkeletonLoader width="60%" height={14} style={{ marginTop: 4 }} />
        <SkeletonLoader width="40%" height={12} style={{ marginTop: 4 }} />
      </View>
    </View>
  );
}

export function BriefCardSkeleton() {
  return (
    <View style={styles.briefCard}>
      <SkeletonLoader width={64} height={64} borderRadius={BorderRadius.sm} />
      <View style={styles.briefContent}>
        <SkeletonLoader width="85%" height={16} />
        <SkeletonLoader width="50%" height={14} style={{ marginTop: 4 }} />
        <SkeletonLoader width="60%" height={12} style={{ marginTop: 4 }} />
      </View>
      <SkeletonLoader width={36} height={36} borderRadius={18} />
    </View>
  );
}

const styles = StyleSheet.create({
  podcastCard: {
    flexDirection: "row",
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  podcastContent: {
    flex: 1,
    marginLeft: Spacing.md,
    justifyContent: "center",
  },
  episodeCard: {
    flexDirection: "row",
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  episodeContent: {
    flex: 1,
    marginLeft: Spacing.md,
    justifyContent: "center",
  },
  briefCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  briefContent: {
    flex: 1,
    marginLeft: Spacing.md,
    justifyContent: "center",
  },
});
