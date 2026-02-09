import { useCallback, useState } from "react";
import { Alert } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { logAnalyticsEvent } from "@/lib/analytics";
import { TaddyEpisode, TaddyPodcast } from "@/lib/types";

const SKIP_GENERATE_CONFIRMATION_KEY = "@podbrief_skip_generate_confirmation";

interface UseSummarizeOptions {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export function useSummarize(options?: UseSummarizeOptions) {
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const { user, profile, refreshProfile } = useAuth();
  const [isGenerating, setIsGenerating] = useState(false);

  const credits = profile?.credits || 0;
  const isPro = profile?.plan === "pro";

  const generateDirectly = useCallback(
    async (episode: TaddyEpisode, podcast?: TaddyPodcast) => {
      const podcastName = podcast?.name || episode.podcastSeries?.name || "Unknown Podcast";
      const podcastImage = podcast?.imageUrl || episode.podcastSeries?.imageUrl;
      const episodeImage = episode.imageUrl || podcastImage;
      const podcastUuid = podcast?.uuid || episode.podcastSeries?.uuid;

      if (!podcastUuid) {
        Alert.alert(
          "Unable to Generate",
          "Missing podcast information. Please try again from the podcast page."
        );
        return;
      }

      setIsGenerating(true);

      try {
        const { data, error } = await supabase.functions.invoke(
          "generate-brief",
          {
            body: {
              episodeUuid: episode.uuid,
              episodeName: episode.name,
              podcastName: podcastName,
              podcastUuid: podcastUuid,
              episodeThumbnail: episodeImage,
              episodeAudioUrl: episode.audioUrl,
              episodeDuration: episode.duration,
              episodePublishedAt: new Date(episode.datePublished * 1000).toISOString(),
            },
          }
        );

        if (error) throw error;

        await refreshProfile();
        queryClient.invalidateQueries({ queryKey: ["userBriefs"] });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        const isNewGeneration = data.status === "processing";

        if (data.masterBriefId) {
          logAnalyticsEvent({
            eventType: "summary_generated",
            briefId: data.masterBriefId,
            language: profile?.preferred_language || "en",
          });
        }

        if (user?.email && isNewGeneration) {
          const { count } = await supabase
            .from("user_briefs")
            .select("*", { count: "exact", head: true })
            .eq("user_id", user.id)
            .eq("is_hidden", false);

          supabase.functions
            .invoke("sync-to-loops", {
              body: {
                action: "engagement_update",
                email: user.email,
                userId: user.id,
                briefsGenerated: count || 0,
                lastBriefDate: new Date().toISOString(),
              },
            })
            .catch((err) =>
              console.error("[useSummarize] sync-to-loops error:", err)
            );
        }

        const statusMessages: Record<string, string> = {
          processing:
            "Your AI summary is being generated. This usually takes 2-3 minutes. You'll receive a push notification and email when it's ready.",
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
              onPress: () =>
                (navigation as any).navigate("Main", { 
                  screen: "LibraryTab",
                  params: { initialTab: "summaries" }
                }),
            },
          ]
        );

        options?.onSuccess?.();
      } catch (error: any) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

        const errorMessage = error.message || "";
        if (
          errorMessage.includes("402") ||
          errorMessage.toLowerCase().includes("credit")
        ) {
          Alert.alert(
            "No Credits Remaining",
            "You've run out of credits. Upgrade to Pro or wait for your monthly credits to refresh.",
            [
              { text: "OK", style: "cancel" },
              {
                text: "View Plans",
                onPress: () =>
                  (navigation as any).navigate("Main", { screen: "ProfileTab" }),
              },
            ]
          );
        } else {
          Alert.alert(
            "Something went wrong",
            error.message || "Unable to generate summary. Please try again."
          );
        }

        options?.onError?.(error);
      } finally {
        setIsGenerating(false);
      }
    },
    [user, refreshProfile, queryClient, navigation, options]
  );

  const summarize = useCallback(
    async (episode: TaddyEpisode, podcast?: TaddyPodcast) => {
      // Check credits first
      if (!isPro && credits <= 0) {
        Alert.alert(
          "No Credits",
          "You need credits to generate AI summaries. Upgrade to Pro for 30 credits per month.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Upgrade",
              onPress: () =>
                (navigation as any).navigate("Main", { screen: "ProfileTab" }),
            },
          ]
        );
        return;
      }

      // Check if user wants to skip confirmation
      const skipConfirmation = await AsyncStorage.getItem(
        SKIP_GENERATE_CONFIRMATION_KEY
      );

      if (skipConfirmation === "true") {
        // Generate directly without confirmation page
        await generateDirectly(episode, podcast);
      } else {
        // Navigate to confirmation page
        (navigation as any).navigate("GenerateBrief", { episode, podcast });
      }
    },
    [isPro, credits, navigation, generateDirectly]
  );

  return {
    summarize,
    isGenerating,
  };
}

export { SKIP_GENERATE_CONFIRMATION_KEY };
