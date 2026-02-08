import React, { useCallback } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAudioPlayerContext, SPEED_OPTIONS } from "@/contexts/AudioPlayerContext";
import { Spacing, BorderRadius } from "@/constants/theme";

const placeholderImage = require("../../assets/images/podcast-placeholder.png");

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export default function NowPlayingScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const {
    currentItem,
    isPlaying,
    isLoading,
    position,
    duration,
    playbackSpeed,
    pause,
    resume,
    seekTo,
    skipForward,
    skipBackward,
    setSpeed,
    queue,
    playNext,
  } = useAudioPlayerContext();

  const handleSpeedPress = useCallback(() => {
    const speedValues = SPEED_OPTIONS.map(o => o.value);
    const currentIndex = speedValues.indexOf(playbackSpeed);
    const nextIndex = (currentIndex + 1) % speedValues.length;
    setSpeed(speedValues[nextIndex]);
  }, [playbackSpeed, setSpeed]);

  const handleSeek = useCallback(
    (value: number) => {
      seekTo(value);
    },
    [seekTo]
  );

  if (!currentItem) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
        <View style={styles.emptyState}>
          <Feather name="headphones" size={64} color={theme.textTertiary} />
          <ThemedText type="h3" style={styles.emptyText}>
            Nothing Playing
          </ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            Select an episode or summary to start listening
          </ThemedText>
        </View>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.backgroundRoot,
          paddingTop: insets.top + Spacing.xl,
          paddingBottom: insets.bottom + Spacing.xl,
        },
      ]}
    >
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.closeButton}
        >
          <Feather name="chevron-down" size={28} color={theme.text} />
        </Pressable>
        {currentItem.type === "summary" ? (
          <View style={[styles.typeBadge, { backgroundColor: theme.gold }]}>
            <ThemedText
              type="caption"
              style={{ color: theme.buttonText, fontWeight: "600" }}
            >
              Summary
            </ThemedText>
          </View>
        ) : (
          <View style={[styles.typeBadge, { backgroundColor: theme.backgroundSecondary }]}>
            <ThemedText type="caption" style={{ fontWeight: "600" }}>
              Episode
            </ThemedText>
          </View>
        )}
        <View style={styles.placeholder} />
      </View>

      <View style={styles.artworkContainer}>
        <Image
          source={
            currentItem.artwork ? { uri: currentItem.artwork } : placeholderImage
          }
          style={styles.artwork}
          contentFit="cover"
          transition={200}
        />
      </View>

      <View style={styles.info}>
        <ThemedText type="h2" style={styles.title} numberOfLines={2}>
          {currentItem.title}
        </ThemedText>
        <ThemedText type="body" style={styles.podcast} numberOfLines={1}>
          {currentItem.podcast}
        </ThemedText>
      </View>

      <View style={styles.sliderContainer}>
        <Slider
          style={styles.slider}
          value={position}
          minimumValue={0}
          maximumValue={duration || 1}
          onSlidingComplete={handleSeek}
          minimumTrackTintColor={theme.gold}
          maximumTrackTintColor={theme.backgroundTertiary}
          thumbTintColor={theme.gold}
        />
        <View style={styles.timeRow}>
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
            {formatTime(position)}
          </ThemedText>
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
            {formatTime(duration)}
          </ThemedText>
        </View>
      </View>

      <View style={styles.controls}>
        <Pressable onPress={handleSpeedPress} style={styles.speedButton}>
          <ThemedText type="body" style={{ color: theme.gold, fontWeight: "600" }}>
            {playbackSpeed}x
          </ThemedText>
        </Pressable>

        <Pressable onPress={skipBackward} style={styles.skipButton}>
          <Feather name="rotate-ccw" size={28} color={theme.text} />
          <ThemedText type="caption" style={styles.skipLabel}>
            15
          </ThemedText>
        </Pressable>

        <Pressable
          onPress={isPlaying ? pause : resume}
          style={[styles.playButton, { backgroundColor: theme.gold }]}
        >
          {isLoading ? (
            <Feather name="loader" size={32} color={theme.buttonText} />
          ) : (
            <Feather
              name={isPlaying ? "pause" : "play"}
              size={32}
              color={theme.buttonText}
            />
          )}
        </Pressable>

        <Pressable onPress={skipForward} style={styles.skipButton}>
          <Feather name="rotate-cw" size={28} color={theme.text} />
          <ThemedText type="caption" style={styles.skipLabel}>
            15
          </ThemedText>
        </Pressable>

        <Pressable
          onPress={playNext}
          style={styles.speedButton}
          disabled={queue.length === 0}
        >
          <Feather
            name="skip-forward"
            size={24}
            color={queue.length > 0 ? theme.text : theme.textTertiary}
          />
        </Pressable>
      </View>

      {queue.length > 0 ? (
        <View style={styles.upNext}>
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
            Up next
          </ThemedText>
          <ThemedText type="small" numberOfLines={1}>
            {queue[0].title}
          </ThemedText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.xl,
  },
  closeButton: {
    padding: Spacing.sm,
  },
  typeBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  placeholder: {
    width: 44,
  },
  artworkContainer: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  artwork: {
    width: Spacing.artworkXl,
    height: Spacing.artworkXl,
    borderRadius: BorderRadius.xl,
  },
  info: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  title: {
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  podcast: {
    opacity: 0.7,
  },
  sliderContainer: {
    marginBottom: Spacing.xl,
  },
  slider: {
    width: "100%",
    height: 40,
  },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: -Spacing.sm,
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.md,
  },
  speedButton: {
    padding: Spacing.md,
    minWidth: 48,
    alignItems: "center",
  },
  skipButton: {
    padding: Spacing.md,
    alignItems: "center",
  },
  skipLabel: {
    position: "absolute",
    bottom: 8,
    fontSize: 10,
  },
  playButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  upNext: {
    marginTop: Spacing["2xl"],
    alignItems: "center",
    gap: Spacing.xs,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.md,
  },
  emptyText: {
    marginTop: Spacing.md,
  },
});
