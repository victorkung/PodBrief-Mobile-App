import React, { useCallback } from "react";
import { View, StyleSheet, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Sharing from "expo-sharing";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useAudioPlayerContext } from "@/contexts/AudioPlayerContext";
import { supabase } from "@/lib/supabase";
import { TaddyEpisode, SavedEpisode, AudioItem } from "@/lib/types";
import { Spacing, BorderRadius } from "@/constants/theme";

const placeholderImage = require("../../assets/images/podcast-placeholder.png");

type EpisodeDetailParams = {
  episode: TaddyEpisode | SavedEpisode;
  source: "newEpisodes" | "library";
};

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function formatDate(date: number | string | null): string {
  if (!date) return "";
  const d = typeof date === "number" ? new Date(date) : new Date(date);
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function EpisodeDetailScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<{ params: EpisodeDetailParams }, "params">>();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { play } = useAudioPlayerContext();

  const { episode, source } = route.params;

  const isTaddyEpisode = "uuid" in episode;
  const uuid = isTaddyEpisode ? episode.uuid : episode.taddy_episode_uuid;
  const name = isTaddyEpisode ? episode.name : episode.episode_name;
  const description = isTaddyEpisode ? episode.description : "";
  const imageUrl = isTaddyEpisode
    ? episode.imageUrl || episode.podcastSeries?.imageUrl
    : episode.episode_thumbnail;
  const podcastName = isTaddyEpisode
    ? episode.podcastSeries?.name
    : episode.podcast_name;
  const duration = isTaddyEpisode
    ? episode.duration
    : episode.episode_duration_seconds || 0;
  const publishedAt = isTaddyEpisode
    ? episode.datePublished
    : episode.episode_published_at;
  const audioUrl = isTaddyEpisode ? episode.audioUrl : (episode as SavedEpisode).episode_audio_url;

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user || !isTaddyEpisode) throw new Error("Cannot save");
      const taddyEpisode = episode as TaddyEpisode;
      const { error } = await supabase.from("saved_episodes").insert({
        user_id: user.id,
        taddy_episode_uuid: taddyEpisode.uuid,
        taddy_podcast_uuid: taddyEpisode.podcastSeries?.uuid,
        episode_name: taddyEpisode.name,
        podcast_name: taddyEpisode.podcastSeries?.name,
        episode_thumbnail:
          taddyEpisode.imageUrl || taddyEpisode.podcastSeries?.imageUrl,
        episode_audio_url: taddyEpisode.audioUrl,
        episode_duration_seconds: taddyEpisode.duration,
        episode_published_at: new Date(taddyEpisode.datePublished).toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["savedEpisodes"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.goBack();
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

  const handlePlay = useCallback(() => {
    const audioItem: AudioItem = {
      id: uuid || "",
      type: "episode",
      title: name,
      podcast: podcastName || "",
      artwork: imageUrl || null,
      audioUrl: audioUrl || "",
      duration: duration * 1000,
      progress: 0,
    };
    play(audioItem);
  }, [uuid, name, podcastName, imageUrl, audioUrl, duration, play]);

  const handleShare = useCallback(async () => {
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(`Listen to ${name} from ${podcastName}`);
    }
  }, [name, podcastName]);

  const handleGenerateBrief = useCallback(() => {
    if (isTaddyEpisode) {
      (navigation as any).navigate("GenerateBrief", { episode });
    }
  }, [navigation, episode, isTaddyEpisode]);

  const handleDownload = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

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
        <View style={styles.header}>
          <Image
            source={imageUrl ? { uri: imageUrl } : placeholderImage}
            style={styles.artwork}
            contentFit="cover"
            transition={200}
          />
          <View style={styles.headerInfo}>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              {podcastName}
            </ThemedText>
            <ThemedText
              type="pageTitle"
              numberOfLines={3}
              style={styles.title}
            >
              {name}
            </ThemedText>
            <View style={styles.metaRow}>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                {formatDate(publishedAt)}
              </ThemedText>
              <View style={[styles.dot, { backgroundColor: theme.textTertiary }]} />
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                {formatDuration(duration)}
              </ThemedText>
            </View>
          </View>
        </View>

        {description ? (
          <View style={styles.descriptionSection}>
            <ThemedText type="h4" style={styles.sectionTitle}>
              Description
            </ThemedText>
            <ThemedText
              type="small"
              style={[styles.description, { color: theme.textSecondary }]}
            >
              {description}
            </ThemedText>
          </View>
        ) : null}

        <View style={styles.actionsSection}>
          {source === "newEpisodes" ? (
            <>
              <Pressable
                onPress={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                style={[styles.actionButton, { backgroundColor: "#FFFFFF" }]}
              >
                <Feather name="plus" size={18} color="#000000" />
                <ThemedText
                  type="body"
                  style={{ color: "#000000", marginLeft: Spacing.sm, fontWeight: "600" }}
                >
                  {saveMutation.isPending ? "Adding..." : "Add to Library"}
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={handleGenerateBrief}
                style={[styles.actionButton, { backgroundColor: theme.gold }]}
              >
                <Feather name="zap" size={18} color={theme.buttonText} />
                <ThemedText
                  type="body"
                  style={{
                    color: theme.buttonText,
                    marginLeft: Spacing.sm,
                    fontWeight: "600",
                  }}
                >
                  Summarize
                </ThemedText>
              </Pressable>
            </>
          ) : (
            <>
              <Pressable
                onPress={handlePlay}
                style={[styles.actionButton, { backgroundColor: theme.gold }]}
              >
                <Feather name="play" size={18} color={theme.buttonText} />
                <ThemedText
                  type="body"
                  style={{
                    color: theme.buttonText,
                    marginLeft: Spacing.sm,
                    fontWeight: "600",
                  }}
                >
                  Play
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={handleShare}
                style={[
                  styles.actionButton,
                  { backgroundColor: theme.backgroundSecondary },
                ]}
              >
                <Feather name="share" size={18} color={theme.text} />
                <ThemedText
                  type="body"
                  style={{ color: theme.text, marginLeft: Spacing.sm, fontWeight: "600" }}
                >
                  Share
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={() => markCompleteMutation.mutate()}
                disabled={markCompleteMutation.isPending}
                style={[
                  styles.actionButton,
                  { backgroundColor: theme.backgroundSecondary },
                ]}
              >
                <Feather name="check-circle" size={18} color={theme.text} />
                <ThemedText
                  type="body"
                  style={{ color: theme.text, marginLeft: Spacing.sm, fontWeight: "600" }}
                >
                  {markCompleteMutation.isPending ? "..." : "Mark Complete"}
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={handleDownload}
                style={[
                  styles.actionButton,
                  { backgroundColor: theme.backgroundSecondary },
                ]}
              >
                <Feather name="download" size={18} color={theme.text} />
                <ThemedText
                  type="body"
                  style={{ color: theme.text, marginLeft: Spacing.sm, fontWeight: "600" }}
                >
                  Download
                </ThemedText>
              </Pressable>
            </>
          )}
        </View>
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
    marginBottom: Spacing.xl,
  },
  artwork: {
    width: 100,
    height: 100,
    borderRadius: BorderRadius.md,
  },
  headerInfo: {
    flex: 1,
    marginLeft: Spacing.md,
    justifyContent: "center",
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
  descriptionSection: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    marginBottom: Spacing.sm,
  },
  description: {
    lineHeight: 22,
  },
  actionsSection: {
    gap: Spacing.md,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.md,
  },
});
