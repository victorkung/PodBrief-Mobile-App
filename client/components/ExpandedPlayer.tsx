import React, { useState } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Modal,
  ActivityIndicator,
  ScrollView,
  Share,
  Alert,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { Feather } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { useAudioPlayerContext, SPEED_OPTIONS } from "@/contexts/AudioPlayerContext";
import { Spacing, BorderRadius } from "@/constants/theme";

const placeholderImage = require("../../assets/images/podcast-placeholder.png");

interface ExpandedPlayerProps {
  visible: boolean;
  onClose: () => void;
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function ExpandedPlayer({ visible, onClose }: ExpandedPlayerProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [showSpeedPicker, setShowSpeedPicker] = useState(false);

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
    stop,
  } = useAudioPlayerContext();

  if (!currentItem) return null;

  const typeLabel = currentItem.type === "summary" ? "Summary" : "Full Episode";
  const progress = duration > 0 ? position / duration : 0;

  const handleSliderChange = (value: number) => {
    const newPosition = value * duration;
    seekTo(newPosition);
    Haptics.selectionAsync();
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Check out "${currentItem.title}" on PodBrief`,
        url: `https://podbrief.io/brief/${currentItem.masterBriefId || currentItem.id}`,
      });
    } catch (error) {
      console.error("Error sharing:", error);
    }
  };

  const handleMarkComplete = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert("Marked Complete", "Episode marked as complete.");
  };

  const handleRemove = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert("Remove", "This will remove the episode from your library.", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => {
        stop();
        onClose();
      }},
    ]);
  };

  const handleBluetooth = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert("Bluetooth", "Connect to a Bluetooth device from your device's settings.");
  };

  const handleDownload = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert("Download", "Download functionality coming soon.");
  };

  const handleSpeedChange = (speed: number) => {
    setSpeed(speed);
    setShowSpeedPicker(false);
  };

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Animated.View
        entering={FadeIn.duration(200)}
        exiting={FadeOut.duration(200)}
        style={styles.overlay}
      >
        <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />
      </Animated.View>
      <Animated.View
        entering={SlideInDown.duration(300).springify()}
        exiting={SlideOutDown.duration(250)}
        style={[
          styles.container,
          {
            backgroundColor: theme.backgroundDefault,
            paddingTop: insets.top + Spacing.md,
            paddingBottom: insets.bottom + Spacing.lg,
          },
        ]}
      >
        <Pressable onPress={onClose} style={styles.closeButton}>
          <Feather name="chevron-down" size={24} color={theme.textSecondary} />
          <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: 4 }}>
            Close
          </ThemedText>
        </Pressable>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.artworkContainer}>
            <Image
              source={
                currentItem.artwork
                  ? { uri: currentItem.artwork }
                  : placeholderImage
              }
              style={styles.artwork}
              contentFit="cover"
            />
          </View>

          <View style={[styles.badge, { backgroundColor: theme.gold }]}>
            <ThemedText
              type="caption"
              style={{ color: theme.buttonText, fontWeight: "600" }}
            >
              {typeLabel}
            </ThemedText>
          </View>

          <ThemedText type="h3" style={styles.title} numberOfLines={3}>
            {currentItem.title}
          </ThemedText>
          <ThemedText
            type="body"
            style={[styles.podcast, { color: theme.textSecondary }]}
          >
            {currentItem.podcast}
          </ThemedText>

          <View style={styles.progressContainer}>
            <Slider
              style={styles.slider}
              value={progress}
              onSlidingComplete={handleSliderChange}
              minimumValue={0}
              maximumValue={1}
              minimumTrackTintColor={theme.gold}
              maximumTrackTintColor={theme.backgroundTertiary}
              thumbTintColor={theme.gold}
            />
            <View style={styles.timeRow}>
              <ThemedText type="caption" style={{ color: theme.textTertiary }}>
                {formatTime(position)}
              </ThemedText>
              <ThemedText type="caption" style={{ color: theme.textTertiary }}>
                {formatTime(duration)}
              </ThemedText>
            </View>
          </View>

          <View style={styles.mainControls}>
            <Pressable onPress={() => setShowSpeedPicker(true)} style={styles.speedButton}>
              <ThemedText type="small" style={{ color: theme.text }}>
                {playbackSpeed}x
              </ThemedText>
              <Feather name="chevron-down" size={14} color={theme.text} />
            </Pressable>

            <Pressable onPress={skipBackward} style={styles.skipButton}>
              <Feather name="rotate-ccw" size={28} color={theme.text} />
              <ThemedText type="caption" style={styles.skipLabel}>15</ThemedText>
            </Pressable>

            <Pressable
              onPress={isPlaying ? pause : resume}
              style={[styles.playButton, { backgroundColor: theme.gold }]}
            >
              {isLoading ? (
                <ActivityIndicator size="large" color={theme.buttonText} />
              ) : (
                <Feather
                  name={isPlaying ? "pause" : "play"}
                  size={32}
                  color={theme.buttonText}
                  style={isPlaying ? undefined : { marginLeft: 4 }}
                />
              )}
            </Pressable>

            <Pressable onPress={skipForward} style={styles.skipButton}>
              <Feather name="rotate-cw" size={28} color={theme.text} />
              <ThemedText type="caption" style={styles.skipLabel}>15</ThemedText>
            </Pressable>

            <Pressable onPress={handleBluetooth} style={styles.speedButton}>
              <Feather name="cast" size={20} color={theme.text} />
            </Pressable>
          </View>

          <View style={[styles.actionsRow, { borderTopColor: theme.border }]}>
            <Pressable onPress={handleMarkComplete} style={styles.actionButton}>
              <Feather name="check-circle" size={22} color={theme.textSecondary} />
              <ThemedText type="caption" style={{ color: theme.textSecondary, marginTop: 4 }}>
                Complete
              </ThemedText>
            </Pressable>

            <Pressable onPress={handleDownload} style={styles.actionButton}>
              <Feather name="download" size={22} color={theme.textSecondary} />
              <ThemedText type="caption" style={{ color: theme.textSecondary, marginTop: 4 }}>
                Download
              </ThemedText>
            </Pressable>

            <Pressable onPress={handleShare} style={styles.actionButton}>
              <Feather name="share" size={22} color={theme.textSecondary} />
              <ThemedText type="caption" style={{ color: theme.textSecondary, marginTop: 4 }}>
                Share
              </ThemedText>
            </Pressable>

            <Pressable onPress={handleRemove} style={styles.actionButton}>
              <Feather name="trash-2" size={22} color={theme.textSecondary} />
              <ThemedText type="caption" style={{ color: theme.textSecondary, marginTop: 4 }}>
                Remove
              </ThemedText>
            </Pressable>

            <Pressable onPress={handleBluetooth} style={styles.actionButton}>
              <Feather name="bluetooth" size={22} color={theme.textSecondary} />
              <ThemedText type="caption" style={{ color: theme.textSecondary, marginTop: 4 }}>
                Connect
              </ThemedText>
            </Pressable>
          </View>
        </ScrollView>

        {showSpeedPicker ? (
          <View style={[styles.speedPicker, { backgroundColor: theme.backgroundSecondary }]}>
            <View style={styles.speedPickerHeader}>
              <ThemedText type="body" style={{ fontWeight: "600" }}>
                Playback Speed
              </ThemedText>
              <Pressable onPress={() => setShowSpeedPicker(false)}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.speedOptions}>
                {SPEED_OPTIONS.map((option) => (
                  <Pressable
                    key={option.value}
                    onPress={() => handleSpeedChange(option.value)}
                    style={[
                      styles.speedOption,
                      {
                        backgroundColor:
                          playbackSpeed === option.value
                            ? theme.gold
                            : theme.backgroundTertiary,
                      },
                    ]}
                  >
                    <ThemedText
                      type="small"
                      style={{
                        color:
                          playbackSpeed === option.value
                            ? theme.buttonText
                            : theme.text,
                        fontWeight: "600",
                      }}
                    >
                      {option.label}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>
        ) : null}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  container: {
    flex: 1,
  },
  closeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
  },
  content: {
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
  },
  artworkContainer: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
    marginBottom: Spacing.xl,
  },
  artwork: {
    width: 280,
    height: 280,
    borderRadius: BorderRadius.lg,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: Spacing.md,
  },
  title: {
    textAlign: "center",
    marginBottom: Spacing.xs,
    lineHeight: 28,
  },
  podcast: {
    textAlign: "center",
    marginBottom: Spacing.xl,
  },
  progressContainer: {
    width: "100%",
    marginBottom: Spacing.md,
  },
  slider: {
    width: "100%",
    height: 40,
  },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.xs,
    marginTop: -Spacing.sm,
  },
  mainControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  speedButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    gap: 2,
  },
  skipButton: {
    position: "relative",
    padding: Spacing.sm,
  },
  skipLabel: {
    position: "absolute",
    top: "50%",
    left: "50%",
    marginTop: -4,
    marginLeft: -6,
    fontSize: 10,
    fontWeight: "700",
  },
  playButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
  },
  actionButton: {
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  speedPicker: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: Spacing.lg,
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
  },
  speedPickerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  speedOptions: {
    flexDirection: "row",
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  speedOption: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    minWidth: 60,
    alignItems: "center",
  },
});
