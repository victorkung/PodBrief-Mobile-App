import React, { useCallback } from "react";
import { View, StyleSheet, Pressable, Alert, Linking, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import * as Haptics from "expo-haptics";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Spacing, BorderRadius } from "@/constants/theme";

export default function ProfileScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation();
  const { user, profile, signOut, refreshProfile } = useAuth();

  const isPro = profile?.plan === "pro";
  const credits = profile?.credits || 0;

  const handleUpgrade = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout");
      if (error) throw error;
      await WebBrowser.openBrowserAsync(data.url);
      await refreshProfile();
    } catch (error) {
      console.error("Error creating checkout:", error);
      Alert.alert("Error", "Unable to open checkout. Please try again.");
    }
  }, [refreshProfile]);

  const handleManageSubscription = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");
      if (error) throw error;
      await WebBrowser.openBrowserAsync(data.url);
      await refreshProfile();
    } catch (error) {
      console.error("Error opening portal:", error);
      Alert.alert("Error", "Unable to open billing portal. Please try again.");
    }
  }, [refreshProfile]);

  const handleBuyCredits = useCallback(async () => {
    if (!isPro) {
      Alert.alert(
        "Pro Required",
        "Credit refills are only available for Pro subscribers."
      );
      return;
    }
    try {
      const { data, error } = await supabase.functions.invoke("create-credit-refill");
      if (error) throw error;
      await WebBrowser.openBrowserAsync(data.url);
      await refreshProfile();
    } catch (error) {
      console.error("Error creating refill checkout:", error);
      Alert.alert("Error", "Unable to open checkout. Please try again.");
    }
  }, [isPro, refreshProfile]);

  const handleSignOut = useCallback(() => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await signOut();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
      },
    ]);
  }, [signOut]);

  const handleDeleteAccount = useCallback(() => {
    Alert.alert(
      "Delete Account",
      "This action is permanent and cannot be undone. All your data will be deleted.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await supabase.functions.invoke("delete-user");
              if (error) throw error;
              await signOut();
            } catch (error) {
              console.error("Error deleting account:", error);
              Alert.alert("Error", "Unable to delete account. Please try again.");
            }
          },
        },
      ]
    );
  }, [signOut]);

  const SettingsRow = ({
    icon,
    label,
    value,
    onPress,
    danger,
  }: {
    icon: string;
    label: string;
    value?: string;
    onPress?: () => void;
    danger?: boolean;
  }) => (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.settingsRow,
        { opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <Feather
        name={icon as any}
        size={20}
        color={danger ? theme.error : theme.textSecondary}
      />
      <ThemedText
        type="body"
        style={[styles.settingsLabel, danger && { color: theme.error }]}
      >
        {label}
      </ThemedText>
      {value ? (
        <ThemedText type="small" style={{ color: theme.textTertiary }}>
          {value}
        </ThemedText>
      ) : null}
      {onPress ? (
        <Feather name="chevron-right" size={20} color={theme.textTertiary} />
      ) : null}
    </Pressable>
  );

  return (
    <KeyboardAwareScrollViewCompat
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{
        paddingTop: insets.top + Spacing.xl,
        paddingBottom: tabBarHeight + Spacing.miniPlayerHeight + Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
    >
      <View style={styles.header}>
        <View style={[styles.avatar, { backgroundColor: theme.gold }]}>
          <ThemedText type="h1" style={{ color: theme.buttonText }}>
            {profile?.first_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "?"}
          </ThemedText>
        </View>
        <ThemedText type="h2" style={styles.name}>
          {profile?.first_name || "User"}
        </ThemedText>
        <ThemedText type="small" style={{ color: theme.textSecondary }}>
          {user?.email}
        </ThemedText>
      </View>

      <Card style={[styles.creditsCard, { backgroundColor: theme.backgroundDefault }]}>
        <View style={styles.creditsRow}>
          <View>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              Available Credits
            </ThemedText>
            <View style={styles.creditsValue}>
              <ThemedText type="h1" style={{ color: theme.gold }}>
                {credits}
              </ThemedText>
              {isPro ? (
                <View style={[styles.proBadge, { backgroundColor: theme.gold }]}>
                  <ThemedText
                    type="caption"
                    style={{ color: theme.buttonText, fontWeight: "700" }}
                  >
                    PRO
                  </ThemedText>
                </View>
              ) : null}
            </View>
          </View>
          <Button onPress={handleBuyCredits} style={styles.buyButton}>
            Buy Credits
          </Button>
        </View>
      </Card>

      <Card style={[styles.section, { backgroundColor: theme.backgroundDefault }]}>
        <ThemedText type="h4" style={styles.sectionTitle}>
          Subscription
        </ThemedText>
        <SettingsRow
          icon="credit-card"
          label="Plan"
          value={isPro ? "Pro ($19/mo)" : "Free"}
        />
        {isPro ? (
          <SettingsRow
            icon="settings"
            label="Manage Subscription"
            onPress={handleManageSubscription}
          />
        ) : (
          <View style={styles.upgradeContainer}>
            <Button onPress={handleUpgrade}>Upgrade to Pro</Button>
          </View>
        )}
      </Card>

      <Card style={[styles.section, { backgroundColor: theme.backgroundDefault }]}>
        <ThemedText type="h4" style={styles.sectionTitle}>
          Account
        </ThemedText>
        <SettingsRow
          icon="globe"
          label="Language"
          value={profile?.preferred_language?.toUpperCase() || "EN"}
        />
        <SettingsRow icon="log-out" label="Sign Out" onPress={handleSignOut} />
        <SettingsRow
          icon="trash-2"
          label="Delete Account"
          onPress={handleDeleteAccount}
          danger
        />
      </Card>

      <Card style={[styles.section, { backgroundColor: theme.backgroundDefault }]}>
        <ThemedText type="h4" style={styles.sectionTitle}>
          About
        </ThemedText>
        <SettingsRow icon="info" label="Version" value="1.0.0" />
        <SettingsRow
          icon="file-text"
          label="Terms of Service"
          onPress={() => Linking.openURL("https://podbrief.io/terms")}
        />
        <SettingsRow
          icon="shield"
          label="Privacy Policy"
          onPress={() => Linking.openURL("https://podbrief.io/privacy")}
        />
      </Card>
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    alignItems: "center",
    marginBottom: Spacing["2xl"],
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  name: {
    marginBottom: Spacing.xs,
  },
  creditsCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  creditsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  creditsValue: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.xs,
  },
  proBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: Spacing.sm,
  },
  buyButton: {
    paddingHorizontal: Spacing.lg,
  },
  section: {
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
  },
  settingsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  settingsLabel: {
    flex: 1,
  },
  upgradeContainer: {
    marginTop: Spacing.md,
  },
});
