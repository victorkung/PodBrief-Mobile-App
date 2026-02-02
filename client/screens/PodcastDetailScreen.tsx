import React, { useState, useCallback, useRef } from "react";
import {
  FlatList,
  View,
  StyleSheet,
  Pressable,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useRoute, useNavigation } from "@react-navigation/native";
import { Image } from "expo-image";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { EpisodeCard } from "@/components/EpisodeCard";
import { SearchInput } from "@/components/SearchInput";
import { EpisodeCardSkeleton } from "@/components/SkeletonLoader";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useAudioPlayerContext } from "@/contexts/AudioPlayerContext";
import { useToast } from "@/contexts/ToastContext";
import { supabase } from "@/lib/supabase";
import { TaddyPodcast, TaddyEpisode, AudioItem } from "@/lib/types";
import { Spacing, BorderRadius } from "@/constants/theme";

const placeholderImage = require("../../assets/images/podcast-placeholder.png");

export default function PodcastDetailScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation();
  const route = useRoute();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { play } = useAudioPlayerContext();
  const { showToast } = useToast();

  const podcast = (route.params as any)?.podcast as TaddyPodcast;
  const [searchTerm, setSearchTerm] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [showFullDescription, setShowFullDescription] = useState(true);

  const {
    data: podcastDetails,
    isLoading,
    error: podcastError,
    refetch,
  } = useQuery({
    queryKey: ["podcastDetails", podcast.uuid, searchTerm],
    queryFn: async () => {
      console.log("[PodcastDetail] Fetching episodes for:", podcast.uuid);
      const { data, error } = await supabase.functions.invoke(
        "taddy-podcast-details",
        {
          body: {
            uuid: podcast.uuid,
            page: 1,
            limitPerPage: 25,
            searchTerm: searchTerm || undefined,
          },
        }
      );
      if (error) {
        console.error("[PodcastDetail] Edge function error:", error);
        throw error;
      }
      if (!data?.podcast) {
        console.error("[PodcastDetail] No podcast data returned:", data);
        throw new Error("No podcast data returned");
      }
      console.log("[PodcastDetail] Received", data.podcast.episodes?.length || 0, "episodes");
      return data.podcast;
    },
    retry: 2,
  });

  const { data: followedPodcasts } = useQuery({
    queryKey: ["followedPodcasts"],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("followed_podcasts")
        .select("taddy_podcast_uuid")
        .eq("user_id", user.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const isFollowed = followedPodcasts?.some(
    (p) => p.taddy_podcast_uuid === podcast.uuid
  );

  const { data: savedEpisodes } = useQuery({
    queryKey: ["savedEpisodes"],
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

  const followMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("followed_podcasts").insert({
        user_id: user.id,
        taddy_podcast_uuid: podcast.uuid,
        podcast_name: podcast.name,
        podcast_description: podcast.description,
        podcast_image_url: podcast.imageUrl,
        author_name: podcast.authorName,
        total_episodes_count: podcast.totalEpisodesCount,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["followedPodcasts"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const unfollowMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("followed_podcasts")
        .delete()
        .eq("user_id", user.id)
        .eq("taddy_podcast_uuid", podcast.uuid);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["followedPodcasts"] });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    },
  });

  const mutatingEpisodesRef = useRef<Set<string>>(new Set());

  const saveMutation = useMutation({
    mutationFn: async (episode: TaddyEpisode) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("saved_episodes").insert({
        user_id: user.id,
        taddy_episode_uuid: episode.uuid,
        taddy_podcast_uuid: podcast.uuid,
        episode_name: episode.name,
        podcast_name: podcast.name,
        episode_thumbnail: episode.imageUrl || podcast.imageUrl,
        episode_audio_url: episode.audioUrl,
        episode_duration_seconds: episode.duration,
        episode_published_at: new Date(episode.datePublished * 1000).toISOString(),
      });
      if (error) throw error;
      return episode.uuid;
    },
    onSuccess: (uuid) => {
      queryClient.invalidateQueries({ queryKey: ["savedEpisodes"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast("Episode added to your library", "success");
      setTimeout(() => mutatingEpisodesRef.current.delete(uuid), 500);
    },
    onError: (_, episode) => {
      setTimeout(() => mutatingEpisodesRef.current.delete(episode.uuid), 500);
    },
  });

  const removeSavedMutation = useMutation({
    mutationFn: async (episodeUuid: string) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("saved_episodes")
        .delete()
        .eq("user_id", user.id)
        .eq("taddy_episode_uuid", episodeUuid);
      if (error) throw error;
      return episodeUuid;
    },
    onSuccess: (uuid) => {
      queryClient.invalidateQueries({ queryKey: ["savedEpisodes"] });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      showToast("Episode removed from your library", "info");
      setTimeout(() => mutatingEpisodesRef.current.delete(uuid), 500);
    },
    onError: (_, episodeUuid) => {
      setTimeout(() => mutatingEpisodesRef.current.delete(episodeUuid), 500);
    },
  });

  const handleSaveToggle = useCallback((episode: TaddyEpisode, isSaved: boolean) => {
    if (mutatingEpisodesRef.current.has(episode.uuid)) return;
    mutatingEpisodesRef.current.add(episode.uuid);
    if (isSaved) {
      removeSavedMutation.mutate(episode.uuid);
    } else {
      saveMutation.mutate(episode);
    }
  }, [saveMutation, removeSavedMutation]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handlePlayEpisode = useCallback(
    (episode: TaddyEpisode) => {
      const audioItem: AudioItem = {
        id: episode.uuid,
        type: "episode",
        title: episode.name,
        podcast: podcast.name,
        artwork: episode.imageUrl || podcast.imageUrl || null,
        audioUrl: episode.audioUrl,
        duration: episode.duration * 1000,
        progress: 0,
      };
      play(audioItem);
    },
    [play, podcast]
  );

  const handleGenerateBrief = useCallback(
    (episode: TaddyEpisode) => {
      (navigation as any).navigate("GenerateBrief", { episode, podcast });
    },
    [navigation, podcast]
  );

  const handleEpisodePress = useCallback(
    (episode: TaddyEpisode) => {
      (navigation as any).navigate("EpisodeDetail", { episode, podcast });
    },
    [navigation, podcast]
  );

  const episodes = podcastDetails?.episodes || [];

  const renderEmpty = () => {
    if (isLoading) {
      return (
        <View>
          {[1, 2, 3, 4, 5].map((i) => (
            <EpisodeCardSkeleton key={i} />
          ))}
        </View>
      );
    }
    if (podcastError) {
      return (
        <View style={styles.emptyContainer}>
          <Feather name="alert-circle" size={48} color={theme.textTertiary} />
          <ThemedText type="body" style={[styles.emptyTitle, { color: theme.textSecondary }]}>
            Unable to Load Episodes
          </ThemedText>
          <ThemedText type="caption" style={[styles.emptySubtitle, { color: theme.textTertiary }]}>
            Please try again later
          </ThemedText>
          <Pressable 
            onPress={() => refetch()} 
            style={[styles.retryButton, { backgroundColor: theme.gold }]}
          >
            <ThemedText type="caption" style={{ color: theme.buttonText, fontWeight: "600" }}>
              Retry
            </ThemedText>
          </Pressable>
        </View>
      );
    }
    return (
      <View style={styles.emptyContainer}>
        <Feather name="mic" size={48} color={theme.textTertiary} />
        <ThemedText type="body" style={[styles.emptyTitle, { color: theme.textSecondary }]}>
          No Episodes Found
        </ThemedText>
        <ThemedText type="caption" style={[styles.emptySubtitle, { color: theme.textTertiary }]}>
          {searchTerm ? `No episodes matching "${searchTerm}"` : "This podcast has no episodes yet"}
        </ThemedText>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <FlatList
        data={episodes}
        keyExtractor={(item) => item.uuid}
        renderItem={({ item }) => {
          const isSaved = savedEpisodes?.some((e) => e.taddy_episode_uuid === item.uuid);
          const isSummarized = userBriefs?.some((b) => b.taddy_episode_uuid === item.uuid);
          return (
            <EpisodeCard
              episode={item}
              showPodcastName={false}
              isSaved={isSaved}
              isSummarized={isSummarized}
              onPress={() => handleEpisodePress(item)}
              onSavePress={() => handleSaveToggle(item, isSaved ?? false)}
              onGenerateBriefPress={() => handleGenerateBrief(item)}
            />
          );
        }}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.headerRow}>
              <Image
                source={podcast.imageUrl ? { uri: podcast.imageUrl } : placeholderImage}
                style={styles.artwork}
                contentFit="cover"
                transition={200}
              />
              <View style={styles.headerInfo}>
                <ThemedText type="h3" numberOfLines={3} style={styles.title}>
                  {podcast.name}
                </ThemedText>
                <ThemedText type="caption" numberOfLines={1} style={[styles.author, { color: theme.textSecondary }]}>
                  {podcast.authorName || "Unknown"}
                </ThemedText>
                <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                  {podcast.totalEpisodesCount} episodes
                </ThemedText>
                <Pressable
                  onPress={() =>
                    isFollowed ? unfollowMutation.mutate() : followMutation.mutate()
                  }
                  style={[
                    styles.followButton,
                    {
                      backgroundColor: isFollowed
                        ? theme.backgroundTertiary
                        : theme.gold,
                    },
                  ]}
                >
                  <Feather
                    name={isFollowed ? "check" : "plus"}
                    size={14}
                    color={isFollowed ? theme.text : theme.buttonText}
                  />
                  <ThemedText
                    type="caption"
                    style={{
                      color: isFollowed ? theme.text : theme.buttonText,
                      fontWeight: "600",
                      marginLeft: 4,
                    }}
                  >
                    {isFollowed ? "Following" : "Follow"}
                  </ThemedText>
                </Pressable>
              </View>
            </View>

            {podcast.description ? (
              <View style={styles.aboutSection}>
                <ThemedText type="h4" style={styles.aboutTitle}>
                  About This Show
                </ThemedText>
                <ThemedText type="small" style={[styles.description, { color: theme.textSecondary }]}>
                  {podcast.description}
                </ThemedText>
              </View>
            ) : null}

            <ThemedText type="h4" style={styles.episodesTitle}>
              Episodes
            </ThemedText>
            <SearchInput
              value={searchTerm}
              onChangeText={setSearchTerm}
              placeholder="Search episodes..."
            />
          </View>
        }
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.xl,
          paddingBottom: insets.bottom + Spacing.miniPlayerHeight + Spacing.xl,
          paddingHorizontal: Spacing.lg,
          flexGrow: 1,
        }}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.gold}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    marginBottom: Spacing.lg,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
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
    marginBottom: Spacing.xs,
  },
  author: {
    marginBottom: 2,
  },
  followButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.sm,
  },
  aboutSection: {
    marginTop: Spacing.lg,
  },
  aboutTitle: {
    marginBottom: Spacing.sm,
  },
  description: {
    lineHeight: 22,
  },
  episodesTitle: {
    marginTop: Spacing.xl,
    marginBottom: Spacing.md,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["3xl"],
  },
  emptyTitle: {
    textAlign: "center",
    marginTop: Spacing.lg,
    marginBottom: Spacing.xs,
  },
  emptySubtitle: {
    textAlign: "center",
    maxWidth: 260,
  },
  retryButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.lg,
  },
});
