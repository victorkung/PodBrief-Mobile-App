import React, { useState } from "react";
import { View, TextInput, StyleSheet, Pressable, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

interface SearchInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
}

export function SearchInput({
  value,
  onChangeText,
  onSubmit,
  placeholder = "Search for podcasts...",
  autoFocus = false,
}: SearchInputProps) {
  const { theme } = useTheme();
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.backgroundSecondary,
          borderColor: isFocused ? theme.gold : "transparent",
        },
      ]}
    >
      <Feather
        name="search"
        size={20}
        color={isFocused ? theme.gold : theme.textTertiary}
      />
      <TextInput
        style={[styles.input, { color: theme.text }]}
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={placeholder}
        placeholderTextColor={theme.textTertiary}
        autoFocus={autoFocus}
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
      />
      {value.length > 0 ? (
        <Pressable onPress={() => onChangeText("")} style={styles.clearButton}>
          <Feather name="x" size={18} color={theme.textTertiary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
  },
  input: {
    flex: 1,
    marginLeft: Spacing.sm,
    fontSize: 16,
    ...Platform.select({
      web: {
        outlineStyle: "none",
      },
    }),
  },
  clearButton: {
    padding: Spacing.xs,
  },
});
