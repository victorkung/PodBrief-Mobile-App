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
    <View style={styles.rowCard}>
      <SkeletonLoader width={56} height={56} borderRadius={BorderRadius.xs} />
      <View style={styles.rowContent}>
        <SkeletonLoader width="75%" height={14} />
        <SkeletonLoader width="50%" height={12} style={{ marginTop: 4 }} />
        <SkeletonLoader width="30%" height={12} style={{ marginTop: 4 }} />
      </View>
    </View>
  );
}

export function EpisodeCardSkeleton() {
  return (
    <View style={styles.rowCard}>
      <SkeletonLoader width={56} height={56} borderRadius={BorderRadius.xs} />
      <View style={styles.rowContent}>
        <SkeletonLoader width="80%" height={14} />
        <SkeletonLoader width="50%" height={12} style={{ marginTop: 4 }} />
        <SkeletonLoader width="40%" height={12} style={{ marginTop: 4 }} />
      </View>
    </View>
  );
}

export function BriefCardSkeleton() {
  return (
    <View style={styles.rowCard}>
      <SkeletonLoader width={56} height={56} borderRadius={BorderRadius.xs} />
      <View style={styles.rowContent}>
        <SkeletonLoader width="75%" height={14} />
        <SkeletonLoader width="45%" height={12} style={{ marginTop: 4 }} />
        <SkeletonLoader width="55%" height={12} style={{ marginTop: 4 }} />
      </View>
      <SkeletonLoader width={36} height={36} borderRadius={18} />
    </View>
  );
}

const styles = StyleSheet.create({
  rowCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
  },
  rowContent: {
    flex: 1,
    marginLeft: Spacing.md,
    justifyContent: "center",
  },
});
