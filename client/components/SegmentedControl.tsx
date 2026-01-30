import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

interface SegmentedControlProps<T extends string> {
  segments: { key: T; label: string; count?: number }[];
  selectedKey: T;
  onSelect: (key: T) => void;
}

export function SegmentedControl<T extends string>({
  segments,
  selectedKey,
  onSelect,
}: SegmentedControlProps<T>) {
  const { theme } = useTheme();

  const handlePress = (key: T) => {
    if (key !== selectedKey) {
      Haptics.selectionAsync();
      onSelect(key);
    }
  };

  return (
    <View
      style={[styles.container, { backgroundColor: theme.backgroundSecondary }]}
    >
      {segments.map((segment) => {
        const isSelected = segment.key === selectedKey;
        return (
          <Pressable
            key={segment.key}
            onPress={() => handlePress(segment.key)}
            style={[
              styles.segment,
              isSelected && { backgroundColor: theme.backgroundDefault },
            ]}
          >
            <ThemedText
              type="small"
              style={[
                styles.label,
                { color: isSelected ? theme.text : theme.textTertiary },
              ]}
            >
              {segment.label}
            </ThemedText>
            {segment.count !== undefined ? (
              <View
                style={[
                  styles.badge,
                  {
                    backgroundColor: isSelected
                      ? theme.gold
                      : theme.backgroundTertiary,
                  },
                ]}
              >
                <ThemedText
                  type="caption"
                  style={{
                    color: isSelected ? theme.buttonText : theme.textSecondary,
                    fontWeight: "600",
                  }}
                >
                  {segment.count}
                </ThemedText>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    borderRadius: BorderRadius.md,
    padding: 4,
  },
  segment: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    gap: Spacing.xs,
  },
  label: {
    fontWeight: "500",
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    minWidth: 20,
    alignItems: "center",
  },
});
