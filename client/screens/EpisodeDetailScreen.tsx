import React, { useCallback, useState, useRef, useEffect } from "react";
import { View, StyleSheet, ScrollView, Pressable, Share, Alert, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Paths, File, Directory } from "expo-file-system";
import { createDownloadResumable } from "expo-file-system/legacy";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useAudioPlayerContext } from "@/contexts/AudioPlayerContext";
import { useToast } from "@/contexts/ToastContext";
import { useSummarize } from "@/hooks/useSummarize";
import { supabase } from "@/lib/supabase";
import { TaddyEpisode, SavedEpisode, AudioItem } from "@/lib/types";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import { stripHtml, formatDateLong, formatDuration } from "@/lib/utils";

const placeholderImage = require("../../assets/images/podcast-placeholder.png");

type EpisodeDetailParams = {
  episode: TaddyEpisode | SavedEpisode;
  podcast?: { uuid: string; name: string; imageUrl?: string };
  source?: "newEpisodes" | "library" | "podcastDetail";
};

export default function EpisodeDetailScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<{ params: EpisodeDetailParams }, "params">>();
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();
  const { play } = useAudioPlayerContext();
  const { showToast } = useToast();
  const { summarize, isGenerating } = useSummarize();

  const { episode, podcast, source = "podcastDetail" } = route.params;

  const isTaddyEpisode = "uuid" in episode;
  const uuid = isTaddyEpisode ? episode.uuid : episode.taddy_episode_uuid;
  const name = isTaddyEpisode ? episode.name : episode.episode_name;

  // Fetch episode details from Edge Function when viewing a SavedEpisode (to get description)
  // If episode_metadata doesn't exist yet, we create it via ensure-episode-metadata then retry
  const { data: episodeDetails, isLoading: isLoadingDetails, isFetched: isDetailsFetched } = useQuery({
    queryKey: ["episodeDetails", uuid],
    queryFn: async () => {
      const savedEp = episode as SavedEpisode;
      
      try {
        // First attempt - fetch using taddyEpisodeUuid
        const { data, error } = await supabase.functions.invoke("get-episode-details", {
          body: { taddyEpisodeUuid: uuid },
        });
        
        // If found, return the episode
        if (!error && data?.episode) {
          return data.episode;
        }
        
        // Episode metadata doesn't exist yet - create it first
        await supabase.functions.invoke("ensure-episode-metadata", {
          body: {
            taddyEpisodeUuid: savedEp.taddy_episode_uuid,
            taddyPodcastUuid: savedEp.taddy_podcast_uuid,
            name: savedEp.episode_name,
            podcastName: savedEp.podcast_name,
            imageUrl: savedEp.episode_thumbnail,
            audioUrl: savedEp.episode_audio_url,
            durationSeconds: savedEp.episode_duration_seconds,
            publishedAt: savedEp.episode_published_at,
          },
        });
        
        // Retry the details fetch after creating metadata
        const retryResult = await supabase.functions.invoke("get-episode-details", {
          body: { taddyEpisodeUuid: uuid },
        });
        
        return retryResult.data?.episode || null;
      } catch (e) {
        // Network error or edge function failure - fail silently
        return null;
      }
    },
    enabled: !isTaddyEpisode && !!uuid, // Only fetch for SavedEpisodes
    staleTime: 1000 * 60 * 60, // Cache for 1 hour
    retry: false, // Don't retry on failure
  });

  const rawDescription = isTaddyEpisode 
    ? episode.description 
    : (episodeDetails?.description || "");
  const description = stripHtml(rawDescription);
  const imageUrl = isTaddyEpisode
    ? episode.imageUrl || episode.podcastSeries?.imageUrl || podcast?.imageUrl
    : episode.episode_thumbnail;
  const podcastName = isTaddyEpisode
    ? episode.podcastSeries?.name || podcast?.name
    : episode.podcast_name;
  const duration = isTaddyEpisode
    ? episode.duration
    : episode.episode_duration_seconds || 0;
  const publishedAt = isTaddyEpisode
    ? episode.datePublished
    : episode.episode_published_at;
  const audioUrl = isTaddyEpisode ? episode.audioUrl : (episode as SavedEpisode).episode_audio_url;
  const podcastUuid = isTaddyEpisode
    ? episode.podcastSeries?.uuid || podcast?.uuid
    : (episode as SavedEpisode).taddy_podcast_uuid;

  const { data: savedEpisodes } = useQuery({
    queryKey: ["savedEpisodes", "uuidsOnly"],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("saved_episodes")
        .select("taddy_episode_uuid")
        .eq("user_id", user.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: userBriefs } = useQuery({
    queryKey: ["userBriefs"],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("user_briefs")
        .select("master_briefs!inner(taddy_episode_uuid)")
        .eq("user_id", user.id)
        .eq("is_hidden", false);
      if (error) throw error;
      return data?.map((b: any) => ({ taddy_episode_uuid: b.master_briefs?.taddy_episode_uuid })) || [];
    },
    enabled: !!user,
  });

  const isSaved = savedEpisodes?.some((e) => e.taddy_episode_uuid === uuid);
  const isSummarized = userBriefs?.some((b) => b.taddy_episode_uuid === uuid);

  const isMutatingRef = useRef(false);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user || !isTaddyEpisode) throw new Error("Cannot save");
      const taddyEpisode = episode as TaddyEpisode;
      const { error } = await supabase.from("saved_episodes").insert({
        user_id: user.id,
        taddy_episode_uuid: taddyEpisode.uuid,
        taddy_podcast_uuid: podcastUuid,
        episode_name: taddyEpisode.name,
        podcast_name: podcastName,
        episode_thumbnail: imageUrl,
        episode_audio_url: taddyEpisode.audioUrl,
        episode_duration_seconds: taddyEpisode.duration,
        episode_published_at: new Date(taddyEpisode.datePublished * 1000).toISOString(),
      });
      if (error) throw error;
    },
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["savedEpisodes"] });
      queryClient.invalidateQueries({ queryKey: ["savedEpisodes", "uuidsOnly"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast("Episode added to your library", "success");
      setTimeout(() => { isMutatingRef.current = false; }, 500);
      
      if (isTaddyEpisode) {
        const taddyEpisode = episode as TaddyEpisode;
        supabase.functions.invoke('ensure-episode-metadata', {
          body: {
            taddyEpisodeUuid: taddyEpisode.uuid,
            taddyPodcastUuid: podcastUuid,
            name: taddyEpisode.name,
            podcastName: podcastName,
            imageUrl: imageUrl,
            audioUrl: taddyEpisode.audioUrl,
            durationSeconds: taddyEpisode.duration,
            publishedAt: new Date(taddyEpisode.datePublished * 1000).toISOString(),
          },
        }).catch(err => console.error('[saveMutation] ensure-episode-metadata error:', err));
      }
    },
    onError: () => {
      setTimeout(() => { isMutatingRef.current = false; }, 500);
      showToast("Failed to add episode", "error");
    },
  });

  const removeSavedMutation = useMutation({
    mutationFn: async () => {
      if (!user || !isTaddyEpisode) throw new Error("Cannot remove");
      const taddyEpisode = episode as TaddyEpisode;
      const { error } = await supabase
        .from("saved_episodes")
        .delete()
        .eq("user_id", user.id)
        .eq("taddy_episode_uuid", taddyEpisode.uuid);
      if (error) throw error;
    },
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["savedEpisodes"] });
      queryClient.invalidateQueries({ queryKey: ["savedEpisodes", "uuidsOnly"] });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      showToast("Episode removed from your library", "info");
      setTimeout(() => { isMutatingRef.current = false; }, 500);
    },
    onError: () => {
      setTimeout(() => { isMutatingRef.current = false; }, 500);
      showToast("Failed to remove episode", "error");
    },
  });

  const markCompleteMutation = useMutation({
    mutationFn: async () => {
      if (!user || isTaddyEpisode) throw new Error("Cannot mark complete");
      const savedEpisode = episode as SavedEpisode;
      const { error } = await supabase
        .from("saved_episodes")
        .update({ is_completed: true })
        .eq("id", savedEpisode.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["savedEpisodes"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const handlePlay = useCallback(async () => {
    if (!audioUrl) {
      Alert.alert("Error", "No audio available for this episode");
      return;
    }
    
    try {
      const audioItem: AudioItem = {
        id: `episode-${uuid}`,
        type: "episode",
        title: name,
        podcast: podcastName || "",
        artwork: imageUrl || null,
        audioUrl: audioUrl,
        duration: duration * 1000,
        progress: 0,
        savedEpisodeId: !isTaddyEpisode ? (episode as SavedEpisode).id : undefined,
      };
      await play(audioItem);
    } catch (error) {
      console.error("Error playing episode:", error);
      Alert.alert("Error", "Failed to play episode. Please try again.");
    }
  }, [uuid, name, podcastName, imageUrl, audioUrl, duration, play, isTaddyEpisode, episode]);

  const handleShare = useCallback(async () => {
    try {
      const userId = profile?.id;
      const firstName = profile?.first_name || "";
      let shareUrl = `https://podbrief.io/episode/${uuid}`;
      if (userId) {
        shareUrl += `?ref=${userId}&sharedBy=${encodeURIComponent(firstName)}`;
      }
      await Share.share({
        message: `Listen to "${name}" from ${podcastName} on PodBrief: ${shareUrl}`,
        url: shareUrl,
        title: name,
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      if (userId) {
        supabase.functions.invoke("log-share-visit", {
          body: {
            referrerId: userId,
            masterBriefId: uuid,
            contentType: "episode",
          },
        }).catch((err) => console.error("[Share] log-share-visit failed:", err));
      }
    } catch (error) {
      console.error("Error sharing:", error);
    }
  }, [uuid, name, podcastName, profile]);

  const handleGenerateBrief = useCallback(() => {
    if (isTaddyEpisode) {
      summarize(episode as TaddyEpisode, podcast as any);
    }
  }, [summarize, episode, podcast, isTaddyEpisode]);

  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = useCallback(async () => {
    if (Platform.OS === "web") {
      Alert.alert("Downloads Unavailable", "Downloads are only available in the mobile app. Open PodBrief in Expo Go to download episodes for offline listening.");
      return;
    }

    if (!audioUrl) {
      Alert.alert("Error", "No audio available to download");
      return;
    }

    setIsDownloading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const docDir = Paths.document;
      const fileName = `episode_${uuid}.mp3`;
      const downloadDir = new Directory(docDir, "downloads");
      
      if (!downloadDir.exists) {
        downloadDir.create();
      }

      const fileUri = `${downloadDir.uri}/${fileName}`;

      const downloadResumable = createDownloadResumable(
        audioUrl,
        fileUri,
        {},
        undefined
      );

      const result = await downloadResumable.downloadAsync();
      if (!result || result.status !== 200) {
        throw new Error("Download failed");
      }

      const downloadedFile = new File(downloadDir, fileName);
      const fileSize = downloadedFile.size || 0;

      const downloadData = {
        id: `episode-${uuid}`,
        type: "episode" as const,
        title: name,
        podcast: podcastName || "",
        artwork: imageUrl || null,
        filePath: downloadedFile.uri,
        fileSize: fileSize,
        downloadedAt: new Date().toISOString(),
        sourceId: isTaddyEpisode ? undefined : (episode as SavedEpisode).id,
        taddyEpisodeUuid: uuid,
        taddyPodcastUuid: podcastUuid,
        episodeDurationSeconds: duration,
        episodePublishedAt: typeof publishedAt === "number" 
          ? new Date(publishedAt * 1000).toISOString() 
          : publishedAt,
        audioUrl: audioUrl,
      };

      const existingDownloads = await AsyncStorage.getItem("@podbrief_downloads");
      const downloads = existingDownloads ? JSON.parse(existingDownloads) : [];
      const filteredDownloads = downloads.filter((d: any) => d.id !== downloadData.id);
      filteredDownloads.push(downloadData);
      await AsyncStorage.setItem("@podbrief_downloads", JSON.stringify(filteredDownloads));

      if (!isSaved && isTaddyEpisode && user) {
        const taddyEpisode = episode as TaddyEpisode;
        await supabase.from("saved_episodes").insert({
          user_id: user.id,
          taddy_episode_uuid: taddyEpisode.uuid,
          taddy_podcast_uuid: podcastUuid,
          episode_name: taddyEpisode.name,
          podcast_name: podcastName,
          episode_thumbnail: imageUrl,
          episode_audio_url: taddyEpisode.audioUrl,
          episode_duration_seconds: taddyEpisode.duration,
          episode_published_at: new Date(taddyEpisode.datePublished * 1000).toISOString(),
        });
        queryClient.invalidateQueries({ queryKey: ["savedEpisodes"] });
        queryClient.invalidateQueries({ queryKey: ["savedEpisodes", "uuidsOnly"] });
        
        supabase.functions.invoke('ensure-episode-metadata', {
          body: {
            taddyEpisodeUuid: taddyEpisode.uuid,
            taddyPodcastUuid: podcastUuid,
            name: taddyEpisode.name,
            podcastName: podcastName,
            imageUrl: imageUrl,
            audioUrl: taddyEpisode.audioUrl,
            durationSeconds: taddyEpisode.duration,
            publishedAt: new Date(taddyEpisode.datePublished * 1000).toISOString(),
          },
        }).catch(err => console.error('[handleDownload] ensure-episode-metadata error:', err));
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Downloaded", `"${name}" has been saved for offline listening.`);
    } catch (error) {
      console.error("Download error:", error);
      Alert.alert("Download Failed", "Unable to download this episode. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  }, [uuid, name, podcastName, imageUrl, audioUrl, duration, publishedAt, podcastUuid, isTaddyEpisode, isSaved, user, episode, queryClient]);

  const handleAddToLibrary = useCallback(() => {
    if (isMutatingRef.current) return;
    isMutatingRef.current = true;
    if (isSaved) {
      removeSavedMutation.mutate();
    } else {
      saveMutation.mutate();
    }
  }, [isSaved, saveMutation, removeSavedMutation]);

  const shouldShowSkeleton = !isTaddyEpisode && isLoadingDetails;

  const SkeletonBox = ({ width, height, style }: { width: number | string; height: number; style?: any }) => {
    const opacity = useSharedValue(0.3);
    
    useEffect(() => {
      opacity.value = withRepeat(
        withTiming(0.7, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );
    }, []);

    const animatedStyle = useAnimatedStyle(() => ({
      opacity: opacity.value,
    }));

    return (
      <Animated.View
        style={[
          {
            width,
            height,
            backgroundColor: theme.backgroundTertiary,
            borderRadius: BorderRadius.sm,
          },
          animatedStyle,
          style,
        ]}
      />
    );
  };

  if (shouldShowSkeleton) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
        <ScrollView
          contentContainerStyle={{
            paddingTop: headerHeight + Spacing.lg,
            paddingBottom: insets.bottom + Spacing.miniPlayerHeight + Spacing.xl,
            paddingHorizontal: Spacing.lg,
          }}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <SkeletonBox width={100} height={100} style={{ borderRadius: BorderRadius.md }} />
            <View style={[styles.headerInfo, { gap: Spacing.xs }]}>
              <SkeletonBox width={120} height={14} />
              <SkeletonBox width="90%" height={20} />
              <SkeletonBox width="70%" height={20} />
              <SkeletonBox width={100} height={14} />
            </View>
          </View>

          <SkeletonBox width="100%" height={120} style={{ borderRadius: BorderRadius.md, marginBottom: Spacing.xl }} />

          <View style={styles.descriptionSection}>
            <SkeletonBox width={150} height={18} style={{ marginBottom: Spacing.sm }} />
            <SkeletonBox width="100%" height={14} style={{ marginBottom: Spacing.xs }} />
            <SkeletonBox width="95%" height={14} style={{ marginBottom: Spacing.xs }} />
            <SkeletonBox width="88%" height={14} style={{ marginBottom: Spacing.xs }} />
            <SkeletonBox width="92%" height={14} style={{ marginBottom: Spacing.xs }} />
            <SkeletonBox width="60%" height={14} />
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.lg,
          paddingBottom: insets.bottom + Spacing.miniPlayerHeight + Spacing.xl,
          paddingHorizontal: Spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Image
            source={imageUrl ? { uri: imageUrl } : placeholderImage}
            style={styles.artwork}
            contentFit="cover"
            transition={200}
          />
          <View style={styles.headerInfo}>
            <ThemedText type="caption" numberOfLines={1} style={{ color: theme.textSecondary }}>
              {podcastName}
            </ThemedText>
            <ThemedText
              type="h3"
              numberOfLines={3}
              style={styles.title}
            >
              {name}
            </ThemedText>
            <View style={styles.metaRow}>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                {formatDateLong(publishedAt)}
              </ThemedText>
              <View style={[styles.dot, { backgroundColor: theme.textTertiary }]} />
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                {formatDuration(duration)}
              </ThemedText>
            </View>
          </View>
        </View>

        {!isSummarized ? (
          <View style={[styles.ctaBanner, { backgroundColor: theme.backgroundDefault }]}>
            <ThemedText type="h4" style={styles.ctaTitle}>
              Want a quick summary?
            </ThemedText>
            <ThemedText type="small" style={[styles.ctaDescription, { color: theme.textSecondary }]}>
              Generate an AI-powered summary for this episode that you can read or listen to in ~5 min instead of spending {formatDuration(duration)} on the full episode.
            </ThemedText>
            <Pressable
              onPress={handleGenerateBrief}
              style={[styles.ctaButton, { backgroundColor: theme.gold }]}
            >
              <ThemedText type="caption" style={{ color: theme.buttonText, fontWeight: "500" }}>
                Summarize
              </ThemedText>
            </Pressable>
          </View>
        ) : (
          <View style={[styles.ctaBanner, { backgroundColor: theme.backgroundDefault }]}>
            <View style={styles.ctaCompletedRow}>
              <Feather name="check-circle" size={20} color={Colors.dark.success} />
              <ThemedText type="h4" style={[styles.ctaTitle, { marginLeft: Spacing.sm, marginBottom: 0 }]}>
                Summary Available
              </ThemedText>
            </View>
            <ThemedText type="small" style={[styles.ctaDescription, { color: theme.textSecondary }]}>
              You've already generated a brief for this episode. View it in your Library.
            </ThemedText>
          </View>
        )}

        {description ? (
          <View style={styles.descriptionSection}>
            <ThemedText type="h4" style={styles.sectionTitle}>
              About This Episode
            </ThemedText>
            <ThemedText
              type="small"
              style={[styles.description, { color: theme.text }]}
            >
              {description}
            </ThemedText>
          </View>
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
    marginTop: 10,
    marginBottom: Spacing.lg + 5,
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
  ctaBanner: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xl,
  },
  ctaTitle: {
    marginBottom: Spacing.sm,
  },
  ctaDescription: {
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  ctaButton: {
    alignSelf: "flex-start",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  ctaCompletedRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  descriptionSection: {
    marginTop: Spacing.sm,
  },
  sectionTitle: {
    marginBottom: Spacing.sm,
  },
  description: {
    lineHeight: 18,
  },
});
