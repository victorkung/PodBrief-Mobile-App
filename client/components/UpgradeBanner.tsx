import React, { useCallback } from "react";
import { View, StyleSheet, Pressable, Alert } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import * as WebBrowser from "expo-web-browser";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Spacing, BorderRadius, GradientColors } from "@/constants/theme";

type BannerState = "free" | "low_credits" | "zero_credits" | null;

function getBannerState(plan?: string, credits?: number): BannerState {
  if (!plan || plan === "free") return "free";
  if (credits === 0) return "zero_credits";
  if (typeof credits === "number" && credits <= 3) return "low_credits";
  return null;
}

export function UpgradeBanner() {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const { profile, refreshProfile } = useAuth();

  const bannerState = getBannerState(profile?.plan, profile?.credits);

  const handleCreditRefill = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke("create-credit-refill", {
        body: { source: "mobile" },
      });
      if (error) throw error;
      await WebBrowser.openBrowserAsync(data.url);
      await refreshProfile();
    } catch (error) {
      console.error("Error creating refill checkout:", error);
      Alert.alert("Error", "Unable to open checkout. Please try again.");
    }
  }, [refreshProfile]);

  if (!bannerState) return null;

  if (bannerState === "free") {
    return (
      <Pressable
        testID="banner-upgrade"
        onPress={() => (navigation as any).navigate("Pricing")}
        style={({ pressed }) => [
          styles.banner,
          { borderColor: `${theme.gold}40`, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <LinearGradient
          colors={[`${theme.gold}15`, `${theme.gold}08`]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.bannerContent}>
          <View style={styles.bannerTextContainer}>
            <ThemedText type="body" style={{ color: theme.gold, fontWeight: "600" }}>
              Unlock AI Summaries
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              Save hours every week with AI-powered podcast briefs
            </ThemedText>
          </View>
          <View style={[styles.bannerAction, { backgroundColor: theme.gold }]}>
            <ThemedText type="small" style={{ color: theme.buttonText, fontWeight: "700" }}>
              Upgrade
            </ThemedText>
          </View>
        </View>
      </Pressable>
    );
  }

  const isZero = bannerState === "zero_credits";
  return (
    <Pressable
      testID="banner-credits"
      onPress={handleCreditRefill}
      style={({ pressed }) => [
        styles.banner,
        {
          borderColor: isZero ? `${theme.error}40` : `${theme.warning}40`,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <LinearGradient
        colors={
          isZero
            ? [`${theme.error}15`, `${theme.error}08`]
            : [`${theme.warning}15`, `${theme.warning}08`]
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.bannerContent}>
        <View style={styles.bannerTextContainer}>
          <ThemedText
            type="body"
            style={{ color: isZero ? theme.error : theme.warning, fontWeight: "600" }}
          >
            {isZero ? "No Credits Remaining" : `${profile?.credits} Credits Left`}
          </ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {isZero
              ? "Buy more credits to keep generating summaries"
              : "Running low — refill to keep generating summaries"}
          </ThemedText>
        </View>
        <View
          style={[
            styles.bannerAction,
            { backgroundColor: isZero ? theme.error : theme.warning },
          ]}
        >
          <ThemedText type="small" style={{ color: theme.buttonText, fontWeight: "700" }}>
            Refill
          </ThemedText>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: Spacing.lg,
  },
  bannerContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    gap: Spacing.md,
  },
  bannerTextContainer: {
    flex: 1,
    gap: 2,
  },
  bannerAction: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.xs,
  },
});
