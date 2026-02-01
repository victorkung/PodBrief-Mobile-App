import React, { useState } from "react";
import { View, TextInput, StyleSheet, Pressable, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

interface SearchInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  showButton?: boolean;
  isLoading?: boolean;
}

export function SearchInput({
  value,
  onChangeText,
  onSubmit,
  placeholder = "Search for podcasts...",
  autoFocus = false,
  showButton = false,
  isLoading = false,
}: SearchInputProps) {
  const { theme } = useTheme();
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={styles.wrapper}>
      <View
        style={[
          styles.container,
          {
            backgroundColor: theme.backgroundSecondary,
            borderColor: isFocused ? theme.gold : theme.border,
          },
          showButton && styles.containerWithButton,
        ]}
      >
        <Feather
          name="search"
          size={18}
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
        {value.length > 0 && !showButton ? (
          <Pressable onPress={() => onChangeText("")} style={styles.clearButton}>
            <Feather name="x" size={18} color={theme.textTertiary} />
          </Pressable>
        ) : null}
      </View>
      {showButton ? (
        <Pressable
          onPress={onSubmit}
          disabled={isLoading || !value.trim()}
          style={[
            styles.searchButton,
            { backgroundColor: theme.backgroundTertiary },
            (isLoading || !value.trim()) && styles.searchButtonDisabled,
          ]}
        >
          <ThemedText
            type="caption"
            style={{ color: theme.text, fontWeight: "600" }}
          >
            {isLoading ? "..." : "Search"}
          </ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  container: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  containerWithButton: {
    borderRadius: BorderRadius.md,
  },
  input: {
    flex: 1,
    marginLeft: Spacing.sm,
    fontSize: 14,
    ...Platform.select({
      web: {
        outlineStyle: "none",
      } as any,
    }),
  },
  clearButton: {
    padding: Spacing.xs,
  },
  searchButton: {
    paddingHorizontal: Spacing.md,
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  searchButtonDisabled: {
    opacity: 0.5,
  },
});
