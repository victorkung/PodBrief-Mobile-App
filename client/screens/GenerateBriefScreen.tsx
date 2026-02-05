import React, { useState, useCallback, useEffect } from "react";
import { View, StyleSheet, ScrollView, Alert, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useRoute, useNavigation } from "@react-navigation/native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { TaddyEpisode, TaddyPodcast } from "@/lib/types";
import { Spacing, BorderRadius } from "@/constants/theme";
import { formatDuration, formatDateLong } from "@/lib/utils";
import { SKIP_GENERATE_CONFIRMATION_KEY } from "@/hooks/useSummarize";

const placeholderImage = require("../../assets/images/podcast-placeholder.png");

export default function GenerateBriefScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation();
  const route = useRoute();
  const queryClient = useQueryClient();
  const { user, profile, refreshProfile } = useAuth();

  const episode = (route.params as any)?.episode as TaddyEpisode;
  const podcast = (route.params as any)?.podcast as TaddyPodcast | undefined;

  const podcastName = podcast?.name || episode.podcastSeries?.name || "Unknown Podcast";
  const podcastImage = podcast?.imageUrl || episode.podcastSeries?.imageUrl;
  const episodeImage = episode.imageUrl || podcastImage;

  const credits = profile?.credits || 0;
  const isPro = profile?.plan === "pro";

  const [dontShowAgain, setDontShowAgain] = useState(false);

  const generateMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        "generate-taddy-brief",
        {
          body: {
            episodeUuid: episode.uuid,
            episodeName: episode.name,
            podcastName: podcastName,
            podcastUuid: podcast?.uuid || episode.podcastSeries?.uuid,
            episodeThumbnail: episodeImage,
            episodeAudioUrl: episode.audioUrl,
            episodeDuration: episode.duration,
            episodePublishedAt: new Date(episode.datePublished * 1000).toISOString(),
          },
        }
      );
      if (error) throw error;
      return data;
    },
    onSuccess: async (data) => {
      await refreshProfile();
      queryClient.invalidateQueries({ queryKey: ["userBriefs"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // Only sync engagement for NEW brief generations
      const isNewGeneration = data.status === "processing";
      
      if (user?.email && isNewGeneration) {
        const { count } = await supabase
          .from("user_briefs")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("is_hidden", false);
        
        supabase.functions.invoke('sync-to-loops', {
          body: {
            action: 'engagement_update',
            email: user.email,
            userId: user.id,
            briefsGenerated: count || 0,
            lastBriefDate: new Date().toISOString(),
          },
        }).catch(err => console.error('[generateMutation] sync-to-loops error:', err));
      }
      
      // Show appropriate message based on status
      const statusMessages: Record<string, string> = {
        processing: "Your AI summary is being generated. It will be ready in about 1-2 minutes.",
        exists: "You already have this summary in your library!",
        restored: "Summary restored to your library!",
        linked: "Summary added to your library!",
      };
      
      Alert.alert(
        isNewGeneration ? "Summary Generation Started" : "Summary Found",
        statusMessages[data.status] || "Summary is ready!",
        [
          {
            text: "Go to Library",
            onPress: () => (navigation as any).navigate("Main", { screen: "LibraryTab" }),
          },
        ]
      );
    },
    onError: (error: any) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      
      // Handle specific 402 credit error
      const errorMessage = error.message || "";
      if (errorMessage.includes("402") || errorMessage.toLowerCase().includes("credit")) {
        Alert.alert(
          "No Credits Remaining",
          "You've run out of credits. Upgrade to Pro or wait for your monthly credits to refresh.",
          [
            { text: "OK", style: "cancel" },
            {
              text: "View Plans",
              onPress: () => (navigation as any).navigate("Main", { screen: "ProfileTab" }),
            },
          ]
        );
        return;
      }
      
      Alert.alert(
        "Generation Failed",
        error.message || "Unable to generate summary. Please try again."
      );
    },
  });

  const handleGenerate = useCallback(async () => {
    if (!isPro && credits <= 0) {
      Alert.alert(
        "No Credits",
        "You need credits to generate AI summaries. Upgrade to Pro for 30 credits per month.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Upgrade",
            onPress: () => (navigation as any).navigate("Main", { screen: "ProfileTab" }),
          },
        ]
      );
      return;
    }

    // Validate required podcast UUID
    const podcastUuid = podcast?.uuid || episode.podcastSeries?.uuid;
    if (!podcastUuid) {
      Alert.alert(
        "Unable to Generate",
        "Missing podcast information. Please try again from the podcast page."
      );
      return;
    }

    // Save preference if checked
    if (dontShowAgain) {
      await AsyncStorage.setItem(SKIP_GENERATE_CONFIRMATION_KEY, "true");
    }

    // Generate directly - no additional confirmation since this page IS the confirmation
    generateMutation.mutate();
  }, [credits, isPro, episode, generateMutation, navigation, dontShowAgain, podcast]);

  const episodeMinutes = Math.round(episode.duration / 60);

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.lg,
          paddingBottom: insets.bottom + Spacing.xl,
          paddingHorizontal: Spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header - Episode Details Layout */}
        <View style={styles.header}>
          <Image
            source={episodeImage ? { uri: episodeImage } : placeholderImage}
            style={styles.artwork}
            contentFit="cover"
            transition={200}
          />
          <View style={styles.headerInfo}>
            <ThemedText type="caption" numberOfLines={1} style={{ color: theme.textSecondary }}>
              {podcastName}
            </ThemedText>
            <ThemedText type="h3" numberOfLines={3} style={styles.title}>
              {episode.name}
            </ThemedText>
            <View style={styles.metaRow}>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                {formatDateLong(episode.datePublished)}
              </ThemedText>
              <View style={[styles.dot, { backgroundColor: theme.textTertiary }]} />
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                {formatDuration(episode.duration)}
              </ThemedText>
            </View>
          </View>
        </View>

        {/* Conversion Info */}
        <Card style={styles.infoCard}>
          <View style={styles.conversionRow}>
            <View style={[styles.iconCircle, { backgroundColor: theme.gold }]}>
              <Feather name="zap" size={20} color={theme.buttonText} />
            </View>
            <ThemedText type="body" style={styles.conversionText}>
              Turn this {episodeMinutes} minute episode into a ~5 minute summary.
            </ThemedText>
          </View>
        </Card>

        {/* Benefits List */}
        <Card style={styles.infoCard}>
          <ThemedText type="h4" style={styles.infoTitle}>
            What you'll get in exchange for 1 Credit:
          </ThemedText>
          <View style={styles.featureList}>
            {[
              "Full timestamped transcript",
              "AI-condensed transcript",
              "AI-generated summary in your preferred language",
              "Premium AI-narrated audio",
              "Shareable with friends",
            ].map((feature, i) => (
              <View key={i} style={styles.featureRow}>
                <Feather name="check" size={16} color={theme.success} />
                <ThemedText type="small" style={styles.featureText}>
                  {feature}
                </ThemedText>
              </View>
            ))}
          </View>
        </Card>

        {/* Credit Section */}
        <View style={styles.creditSection}>
          <View style={styles.creditRow}>
            <ThemedText type="body">Current Balance:</ThemedText>
            <ThemedText type="body">
              {credits} {credits === 1 ? "Credit" : "Credits"}
            </ThemedText>
          </View>
          <View style={styles.creditRow}>
            <ThemedText type="body">Cost:</ThemedText>
            <ThemedText type="body" style={{ color: theme.gold }}>
              1 Credit
            </ThemedText>
          </View>
          <View style={styles.creditRow}>
            <ThemedText type="body">Remaining Balance:</ThemedText>
            <ThemedText type="body">
              {Math.max(credits - 1, 0)} {credits - 1 === 1 ? "Credit" : "Credits"}
            </ThemedText>
          </View>
        </View>

        {/* Generate Button */}
        <Button
          onPress={handleGenerate}
          disabled={generateMutation.isPending}
          style={styles.generateButton}
        >
          {generateMutation.isPending ? "Generating..." : "Generate Summary"}
        </Button>

        {/* Don't Show Again Checkbox */}
        <Pressable 
          onPress={() => setDontShowAgain(!dontShowAgain)}
          style={styles.checkboxRow}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <View style={[
            styles.checkbox, 
            { borderColor: theme.textSecondary },
            dontShowAgain && { backgroundColor: theme.gold, borderColor: theme.gold }
          ]}>
            {dontShowAgain ? (
              <Feather name="check" size={12} color={theme.buttonText} />
            ) : null}
          </View>
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
            Don't show this again
          </ThemedText>
        </Pressable>

        {!isPro && credits <= 0 ? (
          <ThemedText type="caption" style={styles.noCreditsText}>
            You need credits to generate summaries. Upgrade to Pro for 30 credits/month.
          </ThemedText>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    marginBottom: Spacing.lg,
  },
  artwork: {
    width: 100,
    height: 100,
    borderRadius: BorderRadius.md,
  },
  headerInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  title: {
    marginVertical: Spacing.xs,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    marginHorizontal: 6,
  },
  infoCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  conversionRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  conversionText: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  infoTitle: {
    marginBottom: Spacing.md,
  },
  featureList: {
    gap: Spacing.sm,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  featureText: {
    flex: 1,
  },
  creditSection: {
    marginVertical: Spacing.lg,
    gap: Spacing.sm,
  },
  creditRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  generateButton: {
    marginBottom: Spacing.xl,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  noCreditsText: {
    textAlign: "center",
    opacity: 0.6,
  },
});
