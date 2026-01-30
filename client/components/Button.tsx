import React from "react";
import { Pressable, StyleSheet, ViewStyle, TextStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { GradientColors, Spacing, BorderRadius } from "@/constants/theme";

interface ButtonProps {
  children: React.ReactNode;
  onPress?: () => void;
  variant?: "primary" | "secondary" | "ghost";
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Button({
  children,
  onPress,
  variant = "primary",
  disabled = false,
  style,
  textStyle,
}: ButtonProps) {
  const { theme } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const getTextColor = () => {
    if (disabled) return theme.textTertiary;
    switch (variant) {
      case "primary":
        return theme.buttonText;
      case "secondary":
      case "ghost":
        return theme.text;
      default:
        return theme.buttonText;
    }
  };

  if (variant === "primary") {
    return (
      <AnimatedPressable
        onPress={onPress}
        disabled={disabled}
        onPressIn={() => (scale.value = withSpring(0.97))}
        onPressOut={() => (scale.value = withSpring(1))}
        style={[styles.button, animatedStyle, style]}
      >
        <LinearGradient
          colors={
            disabled
              ? [theme.backgroundTertiary, theme.backgroundTertiary]
              : GradientColors.gold
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          {typeof children === "string" ? (
            <ThemedText
              type="body"
              style={[styles.text, { color: getTextColor() }, textStyle]}
            >
              {children}
            </ThemedText>
          ) : (
            children
          )}
        </LinearGradient>
      </AnimatedPressable>
    );
  }

  const getBackgroundColor = () => {
    if (disabled) return theme.backgroundTertiary;
    switch (variant) {
      case "secondary":
        return theme.backgroundSecondary;
      case "ghost":
        return "transparent";
      default:
        return theme.backgroundSecondary;
    }
  };

  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => (scale.value = withSpring(0.97))}
      onPressOut={() => (scale.value = withSpring(1))}
      style={[
        styles.button,
        styles.flatButton,
        { backgroundColor: getBackgroundColor() },
        animatedStyle,
        style,
      ]}
    >
      {typeof children === "string" ? (
        <ThemedText
          type="body"
          style={[styles.text, { color: getTextColor() }, textStyle]}
        >
          {children}
        </ThemedText>
      ) : (
        children
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: BorderRadius.md,
    overflow: "hidden",
  },
  gradient: {
    height: Spacing.buttonHeight,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
  },
  flatButton: {
    height: Spacing.buttonHeight,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
  },
  text: {
    fontWeight: "600",
    fontFamily: "GoogleSansFlex",
  },
});
