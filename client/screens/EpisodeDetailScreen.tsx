import React, { useCallback, useState } from "react";
import { View, StyleSheet, ScrollView, Pressable, Share, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as FileSystem from "expo-file-system";
import AsyncStorage from "@react-native-async-storage/async-storage";

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["savedEpisodes"] });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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
      };
      await play(audioItem);
    } catch (error) {
      console.error("Error playing episode:", error);
      Alert.alert("Error", "Failed to play episode. Please try again.");
    }
  }, [uuid, name, podcastName, imageUrl, audioUrl, duration, play]);

  const handleShare = useCallback(async () => {
    try {
      const shareUrl = `https://podbrief.io/episode/${uuid}`;
      await Share.share({
        message: `Listen to "${name}" from ${podcastName} on PodBrief: ${shareUrl}`,
        url: shareUrl,
        title: name,
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      console.error("Error sharing:", error);
    }
  }, [uuid, name, podcastName]);

  const handleGenerateBrief = useCallback(() => {
    if (isTaddyEpisode) {
      (navigation as any).navigate("GenerateBrief", { episode, podcast });
    }
  }, [navigation, episode, podcast, isTaddyEpisode]);

  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = useCallback(async () => {
    if (!audioUrl) {
      Alert.alert("Error", "No audio available to download");
      return;
    }

    setIsDownloading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const fileName = `episode_${uuid}.mp3`;
      const filePath = `${FileSystem.documentDirectory}downloads/${fileName}`;

      const dirInfo = await FileSystem.getInfoAsync(`${FileSystem.documentDirectory}downloads`);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(`${FileSystem.documentDirectory}downloads`, { intermediates: true });
      }

      const downloadResult = await FileSystem.downloadAsync(audioUrl, filePath);

      if (downloadResult.status !== 200) {
        throw new Error("Download failed");
      }

      const fileInfo = await FileSystem.getInfoAsync(filePath);
      const fileSize = fileInfo.exists ? (fileInfo as any).size || 0 : 0;

      const downloadData = {
        id: `episode-${uuid}`,
        type: "episode" as const,
        title: name,
        podcast: podcastName || "",
        artwork: imageUrl || null,
        filePath: filePath,
        fileSize: fileSize,
        downloadedAt: new Date().toISOString(),
      };

      const existingDownloads = await AsyncStorage.getItem("@podbrief_downloads");
      const downloads = existingDownloads ? JSON.parse(existingDownloads) : [];
      const filteredDownloads = downloads.filter((d: any) => d.id !== downloadData.id);
      filteredDownloads.push(downloadData);
      await AsyncStorage.setItem("@podbrief_downloads", JSON.stringify(filteredDownloads));

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Downloaded", `"${name}" has been saved for offline listening.`);
    } catch (error) {
      console.error("Download error:", error);
      Alert.alert("Download Failed", "Unable to download this episode. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  }, [uuid, name, podcastName, imageUrl, audioUrl]);

  const handleAddToLibrary = useCallback(() => {
    if (isSaved) {
      removeSavedMutation.mutate();
    } else {
      saveMutation.mutate();
    }
  }, [isSaved, saveMutation, removeSavedMutation]);

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
          <View style={styles.actionsGrid}>
            <Pressable
              onPress={handlePlay}
              style={[styles.gridButton, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}
            >
              <Feather name="play" size={18} color={theme.text} />
              <ThemedText type="small" style={{ color: theme.text, marginLeft: Spacing.sm, fontWeight: "500" }}>
                Play ({formatDuration(duration)})
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={handleShare}
              style={[styles.gridButton, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}
            >
              <Feather name="share-2" size={18} color={theme.text} />
              <ThemedText type="small" style={{ color: theme.text, marginLeft: Spacing.sm, fontWeight: "500" }}>
                Share
              </ThemedText>
            </Pressable>
            {source === "library" ? (
              <Pressable
                onPress={() => markCompleteMutation.mutate()}
                disabled={markCompleteMutation.isPending}
                style={[styles.gridButton, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}
              >
                <Feather name="check" size={18} color={theme.text} />
                <ThemedText type="small" style={{ color: theme.text, marginLeft: Spacing.sm, fontWeight: "500" }}>
                  Mark Complete
                </ThemedText>
              </Pressable>
            ) : (
              <Pressable
                onPress={handleAddToLibrary}
                disabled={saveMutation.isPending || removeSavedMutation.isPending}
                style={[styles.gridButton, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}
              >
                <Feather name={isSaved ? "check" : "plus"} size={18} color={isSaved ? Colors.dark.success : theme.text} />
                <ThemedText type="small" style={{ color: isSaved ? Colors.dark.success : theme.text, marginLeft: Spacing.sm, fontWeight: "500" }}>
                  {saveMutation.isPending ? "Adding..." : removeSavedMutation.isPending ? "Removing..." : isSaved ? "Added" : "Add Episode"}
                </ThemedText>
              </Pressable>
            )}
            <Pressable
              onPress={handleDownload}
              disabled={isDownloading}
              style={[styles.gridButton, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border, opacity: isDownloading ? 0.6 : 1 }]}
            >
              <Feather name={isDownloading ? "loader" : "download"} size={18} color={theme.text} />
              <ThemedText type="small" style={{ color: theme.text, marginLeft: Spacing.sm, fontWeight: "500" }}>
                {isDownloading ? "Downloading..." : "Download"}
              </ThemedText>
            </Pressable>
          </View>
        </View>

        {!isSummarized ? (
          <View style={[styles.ctaBanner, { backgroundColor: theme.backgroundDefault }]}>
            <ThemedText type="h4" style={styles.ctaTitle}>
              Want a quick summary?
            </ThemedText>
            <ThemedText type="small" style={[styles.ctaDescription, { color: theme.textSecondary }]}>
              Generate an AI-powered brief for this episode that comes with a podcast summary that you can read or listen to in ~5 min instead of {formatDuration(duration)}.
            </ThemedText>
            <Pressable
              onPress={handleGenerateBrief}
              style={[styles.ctaButton, { backgroundColor: theme.gold }]}
            >
              <ThemedText type="body" style={{ color: theme.buttonText, fontWeight: "600" }}>
                Generate Brief
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
    marginBottom: Spacing.lg,
  },
  actionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  gridButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    width: "48.5%",
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
    paddingHorizontal: Spacing.lg,
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
    lineHeight: 22,
  },
});
