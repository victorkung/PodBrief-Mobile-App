import React from "react";
import { Pressable, StyleSheet, ViewStyle, TextStyle, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { GradientColors, Spacing, BorderRadius } from "@/constants/theme";

interface GradientButtonProps {
  children: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function GradientButton({
  children,
  onPress,
  disabled = false,
  style,
  textStyle,
}: GradientButtonProps) {
  const { theme } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => (scale.value = withSpring(0.97))}
      onPressOut={() => (scale.value = withSpring(1))}
      style={[styles.button, animatedStyle, style]}
    >
      <LinearGradient
        colors={disabled ? [theme.backgroundTertiary, theme.backgroundTertiary] : GradientColors.gold}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        {typeof children === "string" ? (
          <ThemedText
            type="body"
            style={[
              styles.text,
              { color: disabled ? theme.textTertiary : theme.buttonText },
              textStyle,
            ]}
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
  text: {
    fontWeight: "600",
    fontFamily: "GoogleSansFlex",
  },
});
