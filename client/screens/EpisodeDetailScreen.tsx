import React, { useCallback } from "react";
import { View, StyleSheet, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
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
  const { user } = useAuth();
  const { play } = useAudioPlayerContext();

  const { episode, podcast, source = "podcastDetail" } = route.params;

  const isTaddyEpisode = "uuid" in episode;
  const uuid = isTaddyEpisode ? episode.uuid : episode.taddy_episode_uuid;
  const name = isTaddyEpisode ? episode.name : episode.episode_name;
  const rawDescription = isTaddyEpisode ? episode.description : "";
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
        .select("taddy_episode_uuid")
        .eq("user_id", user.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const isSaved = savedEpisodes?.some((e) => e.taddy_episode_uuid === uuid);
  const isSummarized = userBriefs?.some((b) => b.taddy_episode_uuid === uuid);

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["savedEpisodes"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
      (navigation as any).navigate("GenerateBrief", { episode, podcast });
    }
  }, [navigation, episode, podcast, isTaddyEpisode]);

  const handleDownload = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

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

        <View style={styles.actionsSection}>
          {source === "library" ? (
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
                  Play Episode
                </ThemedText>
              </Pressable>
              <View style={styles.secondaryActionsRow}>
                <Pressable
                  onPress={handleShare}
                  style={[styles.secondaryButton, { backgroundColor: theme.backgroundTertiary }]}
                >
                  <Feather name="share" size={16} color={theme.text} />
                  <ThemedText type="caption" style={{ color: theme.text, marginLeft: 4, fontWeight: "500" }}>
                    Share
                  </ThemedText>
                </Pressable>
                <Pressable
                  onPress={() => markCompleteMutation.mutate()}
                  disabled={markCompleteMutation.isPending}
                  style={[styles.secondaryButton, { backgroundColor: theme.backgroundTertiary }]}
                >
                  <Feather name="check-circle" size={16} color={theme.text} />
                  <ThemedText type="caption" style={{ color: theme.text, marginLeft: 4, fontWeight: "500" }}>
                    {markCompleteMutation.isPending ? "..." : "Complete"}
                  </ThemedText>
                </Pressable>
                <Pressable
                  onPress={handleDownload}
                  style={[styles.secondaryButton, { backgroundColor: theme.backgroundTertiary }]}
                >
                  <Feather name="download" size={16} color={theme.text} />
                  <ThemedText type="caption" style={{ color: theme.text, marginLeft: 4, fontWeight: "500" }}>
                    Download
                  </ThemedText>
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <View style={styles.primaryActionsRow}>
                {isSaved ? (
                  <View style={styles.completedButton}>
                    <Feather name="check" size={16} color={Colors.dark.success} />
                    <ThemedText
                      type="small"
                      style={{ color: Colors.dark.success, marginLeft: 6, fontWeight: "500" }}
                    >
                      Added
                    </ThemedText>
                  </View>
                ) : (
                  <Pressable
                    onPress={() => saveMutation.mutate()}
                    disabled={saveMutation.isPending}
                    style={[styles.primaryButton, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}
                  >
                    <Feather name="plus" size={16} color={theme.text} />
                    <ThemedText
                      type="small"
                      style={{ color: theme.text, marginLeft: 6, fontWeight: "600" }}
                    >
                      {saveMutation.isPending ? "Adding..." : "Add Episode"}
                    </ThemedText>
                  </Pressable>
                )}
                {isSummarized ? (
                  <View style={styles.completedButton}>
                    <Feather name="check" size={16} color={Colors.dark.success} />
                    <ThemedText
                      type="small"
                      style={{ color: Colors.dark.success, marginLeft: 6, fontWeight: "500" }}
                    >
                      Summarized
                    </ThemedText>
                  </View>
                ) : (
                  <Pressable
                    onPress={handleGenerateBrief}
                    style={[styles.primaryButton, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}
                  >
                    <Feather name="zap" size={16} color={theme.text} />
                    <ThemedText
                      type="small"
                      style={{ color: theme.text, marginLeft: 6, fontWeight: "600" }}
                    >
                      Summarize
                    </ThemedText>
                  </Pressable>
                )}
              </View>
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
                  Play Episode
                </ThemedText>
              </Pressable>
            </>
          )}
        </View>

        {description ? (
          <View style={styles.descriptionSection}>
            <ThemedText type="h4" style={styles.sectionTitle}>
              About This Episode
            </ThemedText>
            <ThemedText
              type="small"
              style={[styles.description, { color: theme.textSecondary }]}
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
  actionsSection: {
    marginBottom: Spacing.xl,
    gap: Spacing.md,
  },
  primaryActionsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  completedButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  secondaryActionsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.md,
  },
  descriptionSection: {
    marginTop: Spacing.lg,
  },
  sectionTitle: {
    marginBottom: Spacing.sm,
  },
  description: {
    lineHeight: 22,
  },
});
