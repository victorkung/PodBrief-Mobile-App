import React, { useState, useCallback } from "react";
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

  const podcast = (route.params as any)?.podcast as TaddyPodcast;
  const [searchTerm, setSearchTerm] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const {
    data: podcastDetails,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["podcastDetails", podcast.uuid, searchTerm],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        "taddy-podcast-details",
        {
          body: {
            uuid: podcast.uuid,
            page: 1,
            limitPerPage: 30,
            searchTerm: searchTerm || undefined,
          },
        }
      );
      if (error) throw error;
      return data.podcast;
    },
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
        episode_published_at: new Date(episode.datePublished).toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["savedEpisodes"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

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

  const episodes = podcastDetails?.episodes || [];

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <FlatList
        data={episodes}
        keyExtractor={(item) => item.uuid}
        renderItem={({ item }) => (
          <EpisodeCard
            episode={item}
            showPodcastName={false}
            onPlayPress={() => handlePlayEpisode(item)}
            onSavePress={() => saveMutation.mutate(item)}
            onGenerateBriefPress={() => handleGenerateBrief(item)}
          />
        )}
        ListHeaderComponent={
          <View style={styles.header}>
            <Image
              source={podcast.imageUrl ? { uri: podcast.imageUrl } : placeholderImage}
              style={styles.artwork}
              contentFit="cover"
              transition={200}
            />
            <ThemedText type="h2" style={styles.title}>
              {podcast.name}
            </ThemedText>
            <ThemedText type="small" style={styles.author}>
              {podcast.authorName || "Unknown"}
            </ThemedText>
            <ThemedText type="caption" style={{ color: theme.textTertiary }}>
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
                    ? theme.backgroundSecondary
                    : theme.gold,
                },
              ]}
            >
              <Feather
                name={isFollowed ? "check" : "plus"}
                size={18}
                color={isFollowed ? theme.text : theme.buttonText}
              />
              <ThemedText
                type="body"
                style={{
                  color: isFollowed ? theme.text : theme.buttonText,
                  fontWeight: "600",
                  marginLeft: 6,
                }}
              >
                {isFollowed ? "Following" : "Add to My Shows"}
              </ThemedText>
            </Pressable>

            {podcast.description ? (
              <View
                style={[styles.aboutSection, { backgroundColor: theme.backgroundDefault }]}
              >
                <ThemedText type="h4" style={styles.aboutTitle}>
                  About This Show
                </ThemedText>
                <ThemedText type="small" numberOfLines={4} style={styles.description}>
                  {podcast.description}
                </ThemedText>
              </View>
            ) : null}

            <ThemedText type="h3" style={styles.episodesTitle}>
              Episodes
            </ThemedText>
            <SearchInput
              value={searchTerm}
              onChangeText={setSearchTerm}
              placeholder="Search episodes..."
            />
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <View>
              {[1, 2, 3, 4, 5].map((i) => (
                <EpisodeCardSkeleton key={i} />
              ))}
            </View>
          ) : null
        }
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.xl,
          paddingBottom: insets.bottom + Spacing.miniPlayerHeight + Spacing.xl,
          paddingHorizontal: Spacing.lg,
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
  author: {
    marginBottom: 4,
    opacity: 0.7,
  },
  followButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.lg,
  },
  aboutSection: {
    width: "100%",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.xl,
  },
  aboutTitle: {
    marginBottom: Spacing.sm,
  },
  description: {
    opacity: 0.8,
    lineHeight: 22,
  },
  episodesTitle: {
    alignSelf: "flex-start",
    marginTop: Spacing.xl,
    marginBottom: Spacing.md,
  },
});
