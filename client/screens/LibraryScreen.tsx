import React, { useState, useCallback } from "react";
import { FlatList, View, StyleSheet, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Sharing from "expo-sharing";

import { SegmentedControl } from "@/components/SegmentedControl";
import { EpisodeCard } from "@/components/EpisodeCard";
import { BriefCard } from "@/components/BriefCard";
import { EmptyState } from "@/components/EmptyState";
import {
  EpisodeCardSkeleton,
  BriefCardSkeleton,
} from "@/components/SkeletonLoader";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useAudioPlayerContext } from "@/contexts/AudioPlayerContext";
import { supabase } from "@/lib/supabase";
import { SavedEpisode, UserBrief, TabType, AudioItem } from "@/lib/types";
import { Spacing } from "@/constants/theme";

const emptyEpisodesImage = require("../../assets/images/empty-episodes.png");
const emptySummariesImage = require("../../assets/images/empty-summaries.png");

export default function LibraryScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();
  const { play } = useAudioPlayerContext();

  const [selectedTab, setSelectedTab] = useState<TabType>("summaries");
  const [refreshing, setRefreshing] = useState(false);

  const {
    data: savedEpisodes,
    isLoading: isLoadingEpisodes,
    refetch: refetchEpisodes,
  } = useQuery({
    queryKey: ["savedEpisodes"],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("saved_episodes")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as SavedEpisode[];
    },
    enabled: !!user,
  });

  const {
    data: userBriefs,
    isLoading: isLoadingBriefs,
    refetch: refetchBriefs,
  } = useQuery({
    queryKey: ["userBriefs"],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("user_briefs")
        .select(
          `
          *,
          master_brief:master_briefs(
            id,
            episode_name,
            podcast_name,
            episode_thumbnail,
            summary_text,
            audio_url,
            audio_duration_seconds,
            pipeline_status
          )
        `
        )
        .eq("user_id", user.id)
        .eq("is_hidden", false)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as UserBrief[];
    },
    enabled: !!user,
  });

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchEpisodes(), refetchBriefs()]);
    setRefreshing(false);
  }, [refetchEpisodes, refetchBriefs]);

  const handlePlayEpisode = useCallback(
    (episode: SavedEpisode) => {
      const audioItem: AudioItem = {
        id: episode.id,
        type: "episode",
        title: episode.episode_name,
        podcast: episode.podcast_name,
        artwork: episode.episode_thumbnail,
        audioUrl: episode.episode_audio_url || "",
        duration: (episode.episode_duration_seconds || 0) * 1000,
        progress: episode.audio_progress_seconds * 1000,
        savedEpisodeId: episode.id,
      };
      play(audioItem);
    },
    [play]
  );

  const handlePlayBrief = useCallback(
    (brief: UserBrief) => {
      if (!brief.master_brief || brief.master_brief.pipeline_status !== "completed") {
        return;
      }
      const audioItem: AudioItem = {
        id: brief.id,
        type: "summary",
        title: brief.master_brief.episode_name || "Summary",
        podcast: brief.master_brief.podcast_name || "",
        artwork: brief.master_brief.episode_thumbnail,
        audioUrl: brief.master_brief.audio_url || "",
        duration: (brief.master_brief.audio_duration_seconds || 0) * 1000,
        progress: brief.audio_progress_seconds * 1000,
        masterBriefId: brief.master_brief_id,
        userBriefId: brief.id,
      };
      play(audioItem);
    },
    [play]
  );

  const handleShareBrief = useCallback(async (brief: UserBrief) => {
    const shareUrl = `https://podbrief.io/brief/${brief.slug}`;
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(shareUrl);
    }
  }, []);

  const handleBriefPress = useCallback(
    (brief: UserBrief) => {
      (navigation as any).navigate("BriefDetail", { brief });
    },
    [navigation]
  );

  const segments = [
    { key: "episodes" as TabType, label: "Episodes", count: savedEpisodes?.length || 0 },
    { key: "summaries" as TabType, label: "Summaries", count: userBriefs?.length || 0 },
  ];

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
    return (
      <EmptyState
        image={emptyEpisodesImage}
        title="No Saved Episodes"
        subtitle="Save episodes from shows you follow to listen later"
      />
    );
  };

  const renderBriefsEmpty = () => {
    if (isLoadingBriefs) {
      return (
        <View>
          {[1, 2, 3, 4, 5].map((i) => (
            <BriefCardSkeleton key={i} />
          ))}
        </View>
      );
    }
    return (
      <EmptyState
        image={emptySummariesImage}
        title="No Summaries Yet"
        subtitle="Generate AI summaries from any podcast episode"
      />
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <FlatList
        data={selectedTab === "episodes" ? savedEpisodes || [] : userBriefs || []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) =>
          selectedTab === "episodes" ? (
            <EpisodeCard
              episode={item as SavedEpisode}
              showPodcastName
              onPlayPress={() => handlePlayEpisode(item as SavedEpisode)}
            />
          ) : (
            <BriefCard
              brief={item as UserBrief}
              onPress={() => handleBriefPress(item as UserBrief)}
              onPlayPress={() => handlePlayBrief(item as UserBrief)}
              onSharePress={() => handleShareBrief(item as UserBrief)}
            />
          )
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <ThemedText type="h1" style={styles.title}>
              {profile?.first_name ? `${profile.first_name}'s Library` : "Your Library"}
            </ThemedText>
            <ThemedText type="small" style={styles.subtitle}>
              Your saved episodes and AI summaries
            </ThemedText>
            <SegmentedControl
              segments={segments}
              selectedKey={selectedTab}
              onSelect={setSelectedTab}
            />
          </View>
        }
        ListEmptyComponent={
          selectedTab === "episodes" ? renderEpisodesEmpty() : renderBriefsEmpty()
        }
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.xl,
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
    opacity: 0.7,
  },
});
