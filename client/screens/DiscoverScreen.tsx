import React, { useState, useCallback } from "react";
import { FlatList, View, StyleSheet, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";

import { SearchInput } from "@/components/SearchInput";
import { PodcastCard } from "@/components/PodcastCard";
import { PodcastCardSkeleton } from "@/components/SkeletonLoader";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { TaddyPodcast, FollowedPodcast } from "@/lib/types";
import { Spacing, BorderRadius } from "@/constants/theme";

export default function DiscoverScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [searchTerm, setSearchTerm] = useState("");
  const [submittedTerm, setSubmittedTerm] = useState("");

  const {
    data: searchResults,
    isLoading: isSearching,
    isFetching,
  } = useQuery({
    queryKey: ["podcastSearch", submittedTerm],
    queryFn: async () => {
      if (!submittedTerm) return [];
      const { data, error } = await supabase.functions.invoke("taddy-search", {
        body: { term: submittedTerm, page: 1, limitPerPage: 20 },
      });
      if (error) throw error;
      return data.podcasts as TaddyPodcast[];
    },
    enabled: !!submittedTerm,
    staleTime: 1000 * 60 * 5,
  });

  const { data: followedPodcasts } = useQuery({
    queryKey: ["followedPodcasts"],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("followed_podcasts")
        .select("*")
        .eq("user_id", user.id);
      if (error) throw error;
      return data as FollowedPodcast[];
    },
    enabled: !!user,
  });

  const followMutation = useMutation({
    mutationFn: async (podcast: TaddyPodcast) => {
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

  const handleSearch = useCallback(() => {
    const term = searchTerm.trim();
    if (term && term !== submittedTerm) {
      setSubmittedTerm(term);
    }
  }, [searchTerm, submittedTerm]);

  const isFollowed = useCallback(
    (uuid: string) => {
      return followedPodcasts?.some((p) => p.taddy_podcast_uuid === uuid) || false;
    },
    [followedPodcasts]
  );

  const handleFollowPress = useCallback(
    (podcast: TaddyPodcast) => {
      if (isFollowed(podcast.uuid)) {
        unfollowMutation.mutate(podcast.uuid);
      } else {
        followMutation.mutate(podcast);
      }
    },
    [isFollowed, followMutation, unfollowMutation]
  );

  const handlePodcastPress = useCallback(
    (podcast: TaddyPodcast) => {
      (navigation as any).navigate("PodcastDetail", { podcast });
    },
    [navigation]
  );

  const renderItem = useCallback(
    ({ item }: { item: TaddyPodcast }) => (
      <PodcastCard
        podcast={item}
        isFollowed={isFollowed(item.uuid)}
        onPress={() => handlePodcastPress(item)}
        onFollowPress={() => handleFollowPress(item)}
      />
    ),
    [isFollowed, handlePodcastPress, handleFollowPress]
  );

  const renderEmpty = () => {
    if (isSearching || isFetching) {
      return (
        <View>
          {[1, 2, 3, 4, 5].map((i) => (
            <PodcastCardSkeleton key={i} />
          ))}
        </View>
      );
    }
    if (submittedTerm && searchResults?.length === 0) {
      return (
        <View style={[styles.emptyContainer, { backgroundColor: theme.backgroundDefault }]}>
          <View style={[styles.emptyIconCircle, { backgroundColor: theme.gold }]}>
            <Feather name="search" size={32} color={theme.backgroundRoot} />
          </View>
          <ThemedText type="h3" style={styles.emptyTitle}>
            No results found
          </ThemedText>
          <ThemedText type="body" style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
            We couldn't find any podcasts matching "{submittedTerm}"
          </ThemedText>
        </View>
      );
    }
    return (
      <View style={[styles.emptyContainer, { backgroundColor: theme.backgroundDefault }]}>
        <View style={[styles.emptyIconCircle, { backgroundColor: theme.gold }]}>
          <Feather name="search" size={32} color={theme.backgroundRoot} />
        </View>
        <ThemedText type="h3" style={styles.emptyTitle}>
          Search for podcasts
        </ThemedText>
        <ThemedText type="body" style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
          Search by show name to find your favorite podcasts.
        </ThemedText>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <FlatList
        data={searchResults || []}
        keyExtractor={(item) => item.uuid}
        renderItem={renderItem}
        ListHeaderComponent={
          <View style={styles.header}>
            <ThemedText type="h1" style={styles.title}>
              Search Podcasts
            </ThemedText>
            <ThemedText type="body" style={[styles.subtitle, { color: theme.textSecondary }]}>
              Find shows, add them to your list, and generate summaries for specific episodes.
            </ThemedText>
            <SearchInput
              value={searchTerm}
              onChangeText={setSearchTerm}
              onSubmit={handleSearch}
              placeholder="Search for podcasts..."
              showButton={true}
              isLoading={isSearching || isFetching}
            />
          </View>
        }
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={{
          paddingTop: insets.top + Spacing.lg,
          paddingBottom: tabBarHeight + Spacing.miniPlayerHeight + Spacing.xl,
          paddingHorizontal: Spacing.lg,
          flexGrow: 1,
        }}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        keyboardShouldPersistTaps="handled"
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
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.md,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  emptySubtitle: {
    textAlign: "center",
    maxWidth: 280,
  },
});
