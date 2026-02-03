import React from "react";
import { View, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  FadeIn,
  FadeOut,
} from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAudioPlayerContext } from "@/contexts/AudioPlayerContext";
import { Spacing, BorderRadius } from "@/constants/theme";

const placeholderImage = require("../../assets/images/podcast-placeholder.png");

interface MiniPlayerProps {
  onPress?: () => void;
}

export function MiniPlayer({ onPress }: MiniPlayerProps) {
  const { theme } = useTheme();
  const {
    currentItem,
    isPlaying,
    isLoading,
    position,
    duration,
    pause,
    resume,
  } = useAudioPlayerContext();

  const scale = useSharedValue(1);

  const progress = duration > 0 ? (position / duration) * 100 : 0;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  if (!currentItem) return null;

  const typeLabel = currentItem.type === "summary" ? "Summary" : "Episode";

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(200)}
      style={[
        styles.container,
        { backgroundColor: theme.backgroundSecondary },
      ]}
    >
      <View style={[styles.progressBar, { backgroundColor: theme.backgroundTertiary }]}>
        <Animated.View
          style={[
            styles.progressFill,
            { backgroundColor: theme.gold, width: `${progress}%` },
          ]}
        />
      </View>
      <Pressable
        onPress={onPress}
        onPressIn={() => (scale.value = withSpring(0.99))}
        onPressOut={() => (scale.value = withSpring(1))}
        style={styles.content}
      >
        <Animated.View style={[styles.row, animatedStyle]}>
          <Image
            source={
              currentItem.artwork
                ? { uri: currentItem.artwork }
                : placeholderImage
            }
            style={styles.artwork}
            contentFit="cover"
          />
          <View style={styles.info}>
            <View style={styles.labelRow}>
              <View style={[styles.badge, { backgroundColor: theme.gold }]}>
                <ThemedText
                  type="caption"
                  style={{ color: theme.buttonText, fontWeight: "600", fontSize: 9 }}
                >
                  {typeLabel}
                </ThemedText>
              </View>
            </View>
            <ThemedText type="small" numberOfLines={1} style={styles.title}>
              {currentItem.title}
            </ThemedText>
            <ThemedText
              type="caption"
              numberOfLines={1}
              style={{ color: theme.textTertiary }}
            >
              {currentItem.podcast}
            </ThemedText>
          </View>
          <View style={styles.controls}>
            <Pressable
              onPress={isPlaying ? pause : resume}
              style={[styles.playButton, { backgroundColor: theme.gold }]}
              hitSlop={4}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={theme.buttonText} />
              ) : (
                <Feather
                  name={isPlaying ? "pause" : "play"}
                  size={18}
                  color={theme.buttonText}
                  style={isPlaying ? undefined : { marginLeft: 2 }}
                />
              )}
            </Pressable>
          </View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopLeftRadius: BorderRadius.md,
    borderTopRightRadius: BorderRadius.md,
    overflow: "hidden",
  },
  progressBar: {
    height: 3,
    width: "100%",
  },
  progressFill: {
    height: "100%",
  },
  content: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  artwork: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.xs,
  },
  info: {
    flex: 1,
    marginLeft: Spacing.sm,
  },
  labelRow: {
    flexDirection: "row",
    marginBottom: 2,
  },
  badge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
  },
  title: {
    fontWeight: "600",
    fontSize: 13,
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  playButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
});
