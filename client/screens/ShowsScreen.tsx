import React, { useState, useCallback, useMemo } from "react";
import {
  FlatList,
  View,
  StyleSheet,
  RefreshControl,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";

import { SegmentedControl } from "@/components/SegmentedControl";
import { PodcastCard } from "@/components/PodcastCard";
import { EpisodeCard } from "@/components/EpisodeCard";
import { EmptyState } from "@/components/EmptyState";
import {
  PodcastCardSkeleton,
  EpisodeCardSkeleton,
} from "@/components/SkeletonLoader";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useAudioPlayerContext } from "@/contexts/AudioPlayerContext";
import { useToast } from "@/contexts/ToastContext";
import { supabase } from "@/lib/supabase";
import { FollowedPodcast, TaddyEpisode, ShowsTabType, AudioItem } from "@/lib/types";
import { Spacing } from "@/constants/theme";

const emptyShowsImage = require("../../assets/images/empty-shows.png");

export default function ShowsScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();
  const { play } = useAudioPlayerContext();
  const { showToast } = useToast();

  const [selectedTab, setSelectedTab] = useState<ShowsTabType>("shows");
  const [refreshing, setRefreshing] = useState(false);

  const {
    data: followedPodcasts,
    isLoading: isLoadingPodcasts,
    refetch: refetchPodcasts,
  } = useQuery({
    queryKey: ["followedPodcasts"],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("followed_podcasts")
        .select("*")
        .eq("user_id", user.id)
        .order("podcast_name");
      if (error) throw error;
      return data as FollowedPodcast[];
    },
    enabled: !!user,
  });

  const sortedFollowedPodcasts = useMemo(() => {
    if (!followedPodcasts) return [];
    return [...followedPodcasts].sort((a, b) =>
      (a.podcast_name || "").localeCompare(b.podcast_name || "")
    );
  }, [followedPodcasts]);

  const podcastUuids = useMemo(
    () => followedPodcasts?.map((p) => p.taddy_podcast_uuid) || [],
    [followedPodcasts]
  );

  const {
    data: newEpisodes,
    isLoading: isLoadingEpisodes,
    refetch: refetchEpisodes,
  } = useQuery({
    queryKey: ["newEpisodes", podcastUuids],
    queryFn: async () => {
      if (podcastUuids.length === 0) return [];
      const { data, error } = await supabase.functions.invoke(
        "taddy-latest-episodes",
        {
          body: { uuids: podcastUuids, page: 1, limitPerPage: 30 },
        }
      );
      if (error) throw error;
      return data.episodes as TaddyEpisode[];
    },
    enabled: podcastUuids.length > 0,
    staleTime: 1000 * 60 * 60,
  });

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

  const unfollowMutation = useMutation({
    mutationFn: async (podcastUuid: string) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("followed_podcasts")
        .delete()
        .eq("user_id", user.id)
        .eq("taddy_podcast_uuid", podcastUuid);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["followedPodcasts"] });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (episode: TaddyEpisode) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("saved_episodes").insert({
        user_id: user.id,
        taddy_episode_uuid: episode.uuid,
        taddy_podcast_uuid: episode.podcastSeries?.uuid,
        episode_name: episode.name,
        podcast_name: episode.podcastSeries?.name,
        episode_thumbnail: episode.imageUrl || episode.podcastSeries?.imageUrl,
        episode_audio_url: episode.audioUrl,
        episode_duration_seconds: episode.duration,
        episode_published_at: new Date(episode.datePublished * 1000).toISOString(),
      });
      if (error) throw error;
      return episode.uuid;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["savedEpisodes"] });
      queryClient.invalidateQueries({ queryKey: ["savedEpisodes", "uuidsOnly"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast("Episode added to your library", "success");
    },
    onError: (error) => {
      console.error("[saveMutation] Error saving episode:", error);
      showToast("Failed to add episode", "error");
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["savedEpisodes"] });
      queryClient.invalidateQueries({ queryKey: ["savedEpisodes", "uuidsOnly"] });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      showToast("Episode removed from your library", "info");
    },
    onError: (error) => {
      console.error("[removeSavedMutation] Error removing episode:", error);
      showToast("Failed to remove episode", "error");
    },
  });

  const handleSaveToggle = useCallback((episode: TaddyEpisode, isSaved: boolean) => {
    if (isSaved) {
      removeSavedMutation.mutate(episode.uuid);
    } else {
      saveMutation.mutate(episode);
    }
  }, [saveMutation, removeSavedMutation]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchPodcasts(), refetchEpisodes()]);
    setRefreshing(false);
  }, [refetchPodcasts, refetchEpisodes]);

  const handlePlayEpisode = useCallback(
    (episode: TaddyEpisode) => {
      const audioItem: AudioItem = {
        id: episode.uuid,
        type: "episode",
        title: episode.name,
        podcast: episode.podcastSeries?.name || "",
        artwork: episode.imageUrl || episode.podcastSeries?.imageUrl || null,
        audioUrl: episode.audioUrl,
        duration: episode.duration * 1000,
        progress: 0,
      };
      play(audioItem);
    },
    [play]
  );

  const handleGenerateBrief = useCallback(
    (episode: TaddyEpisode) => {
      (navigation as any).navigate("GenerateBrief", { episode });
    },
    [navigation]
  );

  const handleEpisodePress = useCallback(
    (episode: TaddyEpisode) => {
      (navigation as any).navigate("EpisodeDetail", {
        episode,
        source: "newEpisodes",
      });
    },
    [navigation]
  );

  const handlePodcastPress = useCallback(
    (podcast: FollowedPodcast) => {
      (navigation as any).navigate("PodcastDetail", {
        podcast: {
          uuid: podcast.taddy_podcast_uuid,
          name: podcast.podcast_name,
          imageUrl: podcast.podcast_image_url,
          authorName: podcast.author_name,
          description: podcast.podcast_description,
          totalEpisodesCount: podcast.total_episodes_count,
        },
      });
    },
    [navigation]
  );

  const segments = [
    { key: "shows" as ShowsTabType, label: "Shows" },
    { key: "newEpisodes" as ShowsTabType, label: "New Episodes" },
  ];

  const renderShowsEmpty = () => {
    if (isLoadingPodcasts) {
      return (
        <View>
          {[1, 2, 3, 4].map((i) => (
            <PodcastCardSkeleton key={i} />
          ))}
        </View>
      );
    }
    return (
      <View style={styles.emptyContainer}>
        <Feather name="radio" size={48} color={theme.textTertiary} />
        <ThemedText type="body" style={[styles.emptyTitle, { color: theme.textSecondary }]}>
          No Shows Yet
        </ThemedText>
        <ThemedText type="caption" style={[styles.emptySubtitle, { color: theme.textTertiary }]}>
          Search for podcasts and follow your favorites
        </ThemedText>
      </View>
    );
  };

  const renderEpisodesEmpty = () => {
    if (isLoadingEpisodes) {
      return (
        <View>
          {[1, 2, 3, 4, 5].map((i) => (
            <EpisodeCardSkeleton key={i} />
          ))}
        </View>
      );
    }
    if (!followedPodcasts?.length) {
      return (
        <View style={styles.emptyContainer}>
          <Feather name="radio" size={48} color={theme.textTertiary} />
          <ThemedText type="body" style={[styles.emptyTitle, { color: theme.textSecondary }]}>
            No Shows Followed
          </ThemedText>
          <ThemedText type="caption" style={[styles.emptySubtitle, { color: theme.textTertiary }]}>
            Follow some shows to see their latest episodes
          </ThemedText>
        </View>
      );
    }
    return (
      <View style={styles.emptyContainer}>
        <Feather name="inbox" size={48} color={theme.textTertiary} />
        <ThemedText type="body" style={[styles.emptyTitle, { color: theme.textSecondary }]}>
          No New Episodes
        </ThemedText>
        <ThemedText type="caption" style={[styles.emptySubtitle, { color: theme.textTertiary }]}>
          Check back later for new content
        </ThemedText>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <FlatList
        data={(selectedTab === "shows" ? sortedFollowedPodcasts : newEpisodes || []) as any}
        keyExtractor={(item: any) =>
          "uuid" in item ? item.uuid : item.taddy_podcast_uuid
        }
        renderItem={({ item }) =>
          selectedTab === "shows" ? (
            <PodcastCard
              podcast={item as FollowedPodcast}
              isFollowed
              onPress={() => handlePodcastPress(item as FollowedPodcast)}
              onFollowPress={() =>
                unfollowMutation.mutate((item as FollowedPodcast).taddy_podcast_uuid)
              }
            />
          ) : (
            (() => {
              const ep = item as TaddyEpisode;
              const isSaved = savedEpisodes?.some((e) => e.taddy_episode_uuid === ep.uuid);
              const isSummarized = userBriefs?.some((b) => b.taddy_episode_uuid === ep.uuid);
              return (
                <EpisodeCard
                  episode={ep}
                  isSaved={isSaved}
                  isSummarized={isSummarized}
                  onPress={() => handleEpisodePress(ep)}
                  onSavePress={() => handleSaveToggle(ep, isSaved ?? false)}
                  onGenerateBriefPress={() => handleGenerateBrief(ep)}
                />
              );
            })()
          )
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <ThemedText type="pageTitle" style={styles.title}>
              {profile?.first_name ? `${profile.first_name}'s Shows` : "Your Shows"}
            </ThemedText>
            <ThemedText type="caption" style={[styles.subtitle, { color: theme.textSecondary }]}>
              View your shows and their latest episodes
            </ThemedText>
            <SegmentedControl
              segments={segments}
              selectedKey={selectedTab}
              onSelect={setSelectedTab}
            />
          </View>
        }
        ListEmptyComponent={
          selectedTab === "shows" ? renderShowsEmpty() : renderEpisodesEmpty()
        }
        contentContainerStyle={{
          paddingTop: insets.top + Spacing.xl,
          paddingBottom: tabBarHeight + Spacing.miniPlayerHeight + Spacing.xl,
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
    marginBottom: Spacing.xl,
  },
  title: {
    marginBottom: Spacing.xs,
  },
  subtitle: {
    marginBottom: Spacing.lg,
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
});
