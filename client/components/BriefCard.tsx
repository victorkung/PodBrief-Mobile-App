import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Image } from "expo-image";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import Svg, { Circle } from "react-native-svg";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { UserBrief } from "@/lib/types";

const placeholderImage = require("../../assets/images/podcast-placeholder.png");

interface BriefCardProps {
  brief: UserBrief;
  showDivider?: boolean;
  onPress?: () => void;
  onPlayPress?: () => void;
  onSharePress?: () => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes} min`;
}

function formatDate(dateString: string): string {
  const d = new Date(dateString);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function getLanguageName(code: string): string {
  const languages: Record<string, string> = {
    en: "English",
    es: "Spanish",
    fr: "French",
    de: "German",
    it: "Italian",
    pt: "Portuguese",
    zh: "Chinese",
    ja: "Japanese",
    ko: "Korean",
    ru: "Russian",
    ar: "Arabic",
    hi: "Hindi",
  };
  return languages[code.toLowerCase()] || code;
}

function ProgressRing({
  progress,
  size = 36,
  strokeWidth = 3,
}: {
  progress: number;
  size?: number;
  strokeWidth?: number;
}) {
  const { theme } = useTheme();
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <Svg width={size} height={size}>
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={theme.backgroundTertiary}
        strokeWidth={strokeWidth}
        fill="none"
      />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={theme.gold}
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </Svg>
  );
}

export function BriefCard({
  brief,
  showDivider = true,
  onPress,
  onPlayPress,
  onSharePress,
}: BriefCardProps) {
  const { theme } = useTheme();
  const scale = useSharedValue(1);

  const masterBrief = brief.master_brief;
  const name = masterBrief?.episode_name || "Unknown Episode";
  const podcastName = masterBrief?.podcast_name || "Unknown Podcast";
  const imageUrl = masterBrief?.episode_thumbnail;
  const audioDuration = masterBrief?.audio_duration_seconds || 0;
  const pipelineStatus = masterBrief?.pipeline_status || "pending";

  const progress =
    audioDuration > 0
      ? Math.min((brief.audio_progress_seconds / audioDuration) * 100, 100)
      : 0;

  const isProcessing =
    pipelineStatus !== "completed" && pipelineStatus !== "failed";

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
      <View style={styles.artworkContainer}>
        <Image
          source={imageUrl ? { uri: imageUrl } : placeholderImage}
          style={styles.artwork}
          contentFit="cover"
          transition={200}
        />
        {progress > 0 && !brief.is_completed ? (
          <View style={styles.progressOverlay}>
            <ProgressRing progress={progress} />
          </View>
        ) : null}
        {brief.is_completed ? (
          <View
            style={[styles.completedBadge, { backgroundColor: theme.success }]}
          >
            <Feather name="check" size={12} color="#fff" />
          </View>
        ) : null}
      </View>
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
          style={[styles.podcast, { color: theme.textSecondary }]}
        >
          {podcastName}
        </ThemedText>
        <View style={styles.metaRow}>
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
            {formatDate(brief.created_at)}
          </ThemedText>
          {audioDuration > 0 ? (
            <>
              <View style={[styles.dot, { backgroundColor: theme.textTertiary }]} />
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                {formatDuration(audioDuration)}
              </ThemedText>
            </>
          ) : null}
          <View style={[styles.dot, { backgroundColor: theme.textTertiary }]} />
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
            {getLanguageName(brief.preferred_language)}
          </ThemedText>
        </View>
      </View>
      <View style={styles.actions}>
        {isProcessing ? (
          <View style={styles.processingBadge}>
            <Feather name="loader" size={14} color={theme.warning} />
          </View>
        ) : (
          <>
            {onPlayPress ? (
              <Pressable
                onPress={onPlayPress}
                style={[styles.playButton, { backgroundColor: theme.gold }]}
              >
                <Feather name="play" size={16} color={theme.buttonText} />
              </Pressable>
            ) : null}
            {onSharePress ? (
              <Pressable onPress={onSharePress} style={styles.actionButton}>
                <Feather name="share" size={16} color={theme.textSecondary} />
              </Pressable>
            ) : null}
          </>
        )}
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    paddingVertical: Spacing.md,
    alignItems: "center",
  },
  artworkContainer: {
    position: "relative",
  },
  artwork: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.xs,
  },
  progressOverlay: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "rgba(0,0,0,0.8)",
    borderRadius: 18,
  },
  completedBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
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
    flexWrap: "wrap",
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
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
  playButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  processingBadge: {
    padding: Spacing.sm,
  },
});
