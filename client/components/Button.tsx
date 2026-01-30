import React from "react";
import { Pressable, StyleSheet, ViewStyle, TextStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

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

  const getBackgroundColor = () => {
    if (disabled) return theme.backgroundTertiary;
    switch (variant) {
      case "primary":
        return theme.gold;
      case "secondary":
        return theme.backgroundSecondary;
      case "ghost":
        return "transparent";
      default:
        return theme.gold;
    }
  };

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

  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => (scale.value = withSpring(0.97))}
      onPressOut={() => (scale.value = withSpring(1))}
      style={[
        styles.button,
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
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
  },
  text: {
    fontWeight: "600",
  },
});
