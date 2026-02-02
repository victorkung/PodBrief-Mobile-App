import React, { useState, useCallback, useEffect } from "react";
import { View, StyleSheet, ScrollView, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useRoute, useNavigation } from "@react-navigation/native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { TaddyEpisode, TaddyPodcast } from "@/lib/types";
import { Spacing, BorderRadius } from "@/constants/theme";

const placeholderImage = require("../../assets/images/podcast-placeholder.png");

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function formatDate(timestamp: number): string {
  const d = new Date(timestamp);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

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
            episodeDurationSeconds: episode.duration,
            episodePublishedAt: new Date(episode.datePublished).toISOString(),
            language: profile?.preferred_language || "en",
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
      
      if (user?.email && !data.existing) {
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
      
      Alert.alert(
        "Brief Generation Started",
        data.existing
          ? "You already have this brief in your library!"
          : "Your AI summary is being generated. It will be ready in about 1-2 minutes.",
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
      Alert.alert(
        "Generation Failed",
        error.message || "Unable to generate brief. Please try again."
      );
    },
  });

  const handleGenerate = useCallback(() => {
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

    Alert.alert(
      "Generate Brief",
      `This will use 1 credit to create an AI summary of "${episode.name}". You have ${credits} credits remaining.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Generate",
          onPress: () => generateMutation.mutate(),
        },
      ]
    );
  }, [credits, isPro, episode, generateMutation, navigation]);

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.xl,
          paddingBottom: insets.bottom + Spacing.xl,
          paddingHorizontal: Spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Image
            source={episodeImage ? { uri: episodeImage } : placeholderImage}
            style={styles.artwork}
            contentFit="cover"
            transition={200}
          />
          <ThemedText type="h2" style={styles.title}>
            {episode.name}
          </ThemedText>
          <ThemedText type="small" style={styles.podcast}>
            {podcastName}
          </ThemedText>
          <View style={styles.metaRow}>
            <ThemedText type="caption" style={{ color: theme.textTertiary }}>
              {formatDate(episode.datePublished)}
            </ThemedText>
            <View style={styles.dot} />
            <ThemedText type="caption" style={{ color: theme.textTertiary }}>
              {formatDuration(episode.duration)}
            </ThemedText>
          </View>
        </View>

        <Card style={[styles.infoCard, { backgroundColor: theme.backgroundDefault }]}>
          <View style={styles.infoRow}>
            <View style={[styles.iconCircle, { backgroundColor: theme.gold }]}>
              <Feather name="zap" size={20} color={theme.buttonText} />
            </View>
            <View style={styles.infoContent}>
              <ThemedText type="h4">AI Summary</ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Turn this {formatDuration(episode.duration)} episode into a 5-minute brief
              </ThemedText>
            </View>
          </View>
        </Card>

        <Card style={[styles.infoCard, { backgroundColor: theme.backgroundDefault }]}>
          <ThemedText type="h4" style={styles.infoTitle}>
            What you'll get:
          </ThemedText>
          <View style={styles.featureList}>
            {[
              "Executive summary (~1000 words)",
              "AI-condensed transcript",
              "Full timestamped transcript",
              "Premium AI-narrated audio",
              "Multi-language support",
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

        <View style={styles.creditSection}>
          <View style={styles.creditRow}>
            <ThemedText type="body">Cost:</ThemedText>
            <ThemedText type="h3" style={{ color: theme.gold }}>
              1 Credit
            </ThemedText>
          </View>
          <View style={styles.creditRow}>
            <ThemedText type="body">Your Balance:</ThemedText>
            <ThemedText type="h3">
              {credits} {credits === 1 ? "Credit" : "Credits"}
            </ThemedText>
          </View>
        </View>

        <Button
          onPress={handleGenerate}
          disabled={generateMutation.isPending}
          style={styles.generateButton}
        >
          {generateMutation.isPending ? "Generating..." : "Generate Brief"}
        </Button>

        {!isPro && credits <= 0 ? (
          <ThemedText type="caption" style={styles.noCreditsText}>
            You need credits to generate briefs. Upgrade to Pro for 30 credits/month.
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
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  artwork: {
    width: Spacing.artworkLg,
    height: Spacing.artworkLg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  title: {
    textAlign: "center",
    marginBottom: Spacing.xs,
  },
  podcast: {
    marginBottom: Spacing.sm,
    opacity: 0.7,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: "#6B7280",
    marginHorizontal: 8,
  },
  infoCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  infoContent: {
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
    marginVertical: Spacing.xl,
    gap: Spacing.sm,
  },
  creditRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  generateButton: {
    marginBottom: Spacing.md,
  },
  noCreditsText: {
    textAlign: "center",
    opacity: 0.6,
  },
});
