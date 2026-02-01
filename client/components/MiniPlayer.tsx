import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Image } from "expo-image";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  FadeIn,
  FadeOut,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomTabBarHeightContext } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAudioPlayerContext } from "@/contexts/AudioPlayerContext";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";

const placeholderImage = require("../../assets/images/podcast-placeholder.png");

interface MiniPlayerProps {
  onPress?: () => void;
}

export function MiniPlayer({ onPress }: MiniPlayerProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const tabBarHeightContext = React.useContext(BottomTabBarHeightContext);
  const tabBarHeight = tabBarHeightContext ?? insets.bottom;
  const {
    currentItem,
    isPlaying,
    isLoading,
    position,
    duration,
    pause,
    resume,
    skipForward,
  } = useAudioPlayerContext();

  const scale = useSharedValue(1);

  const progress = duration > 0 ? (position / duration) * 100 : 0;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  if (!currentItem) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(200)}
      style={[
        styles.container,
        {
          backgroundColor: theme.backgroundDefault,
          bottom: tabBarHeight,
        },
        Shadows.player,
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
              {currentItem.type === "summary" ? (
                <View style={[styles.badge, { backgroundColor: theme.gold }]}>
                  <ThemedText
                    type="caption"
                    style={{ color: theme.buttonText, fontWeight: "600" }}
                  >
                    Summary
                  </ThemedText>
                </View>
              ) : null}
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
            <Pressable onPress={skipForward} style={styles.controlButton}>
              <Feather name="rotate-cw" size={20} color={theme.text} />
            </Pressable>
            <Pressable
              onPress={isPlaying ? pause : resume}
              style={[styles.playButton, { backgroundColor: theme.gold }]}
            >
              {isLoading ? (
                <Feather name="loader" size={20} color={theme.buttonText} />
              ) : (
                <Feather
                  name={isPlaying ? "pause" : "play"}
                  size={20}
                  color={theme.buttonText}
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
    position: "absolute",
    left: 0,
    right: 0,
    borderTopLeftRadius: BorderRadius.md,
    borderTopRightRadius: BorderRadius.md,
    overflow: "hidden",
  },
  progressBar: {
    height: 2,
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
    width: 48,
    height: 48,
    borderRadius: BorderRadius.xs,
  },
  info: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  labelRow: {
    flexDirection: "row",
    marginBottom: 2,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  title: {
    fontWeight: "500",
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  controlButton: {
    padding: Spacing.xs,
  },
  playButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
});
