import React, { useState, useCallback, useEffect } from "react";
import { FlatList, View, StyleSheet, RefreshControl, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { File, Directory, Paths } from "expo-file-system";
import * as Haptics from "expo-haptics";

import { SegmentedControl } from "@/components/SegmentedControl";
import { LibraryItemCard } from "@/components/LibraryItemCard";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useAudioPlayerContext } from "@/contexts/AudioPlayerContext";
import { supabase } from "@/lib/supabase";
import { SavedEpisode, UserBrief, TabType, AudioItem, Download } from "@/lib/types";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useToast } from "@/contexts/ToastContext";

const DOWNLOADS_KEY = "@podbrief_downloads";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function LibraryScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();
  const { play } = useAudioPlayerContext();
  const { showToast } = useToast();

  const [selectedTab, setSelectedTab] = useState<TabType>("episodes");
  const [refreshing, setRefreshing] = useState(false);
  const [downloads, setDownloads] = useState<Download[]>([]);
  const [downloadedIds, setDownloadedIds] = useState<Set<string>>(new Set());
  const [totalDownloadSize, setTotalDownloadSize] = useState(0);

  const loadDownloads = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(DOWNLOADS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Download[];
        setDownloads(parsed);
        const ids = new Set(parsed.map((d) => d.sourceId || d.id));
        setDownloadedIds(ids);
        const size = parsed.reduce((acc, d) => acc + d.fileSize, 0);
        setTotalDownloadSize(size);
      }
    } catch (error) {
      console.error("Error loading downloads:", error);
    }
  }, []);

  useEffect(() => {
    loadDownloads();
  }, [loadDownloads]);

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
    await Promise.all([refetchEpisodes(), refetchBriefs(), loadDownloads()]);
    setRefreshing(false);
  }, [refetchEpisodes, refetchBriefs, loadDownloads]);

  useFocusEffect(
    useCallback(() => {
      if (user) {
        refetchEpisodes();
        refetchBriefs();
        loadDownloads();
      }
    }, [user, refetchEpisodes, refetchBriefs, loadDownloads])
  );

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

  const handlePlayDownload = useCallback(
    (download: Download) => {
      const audioItem: AudioItem = {
        id: download.id,
        type: download.type,
        title: download.title,
        podcast: download.podcast,
        artwork: download.artwork,
        audioUrl: download.filePath,
        duration: (download.episodeDurationSeconds || 0) * 1000,
        progress: 0,
      };
      play(audioItem);
    },
    [play]
  );

  const handleRemoveEpisode = useCallback(
    async (episode: SavedEpisode) => {
      try {
        const { error } = await supabase
          .from("saved_episodes")
          .delete()
          .eq("id", episode.id);
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ["savedEpisodes"] });
      } catch (error) {
        console.error("Error removing episode:", error);
        Alert.alert("Error", "Failed to remove episode from library");
      }
    },
    [queryClient]
  );

  const handleRemoveBrief = useCallback(
    async (brief: UserBrief) => {
      try {
        const { error } = await supabase
          .from("user_briefs")
          .update({ is_hidden: true })
          .eq("id", brief.id);
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ["userBriefs"] });
      } catch (error) {
        console.error("Error removing brief:", error);
        Alert.alert("Error", "Failed to remove summary from library");
      }
    },
    [queryClient]
  );

  const handleRemoveDownload = useCallback(
    async (download: Download) => {
      try {
        const file = new File(download.filePath);
        if (file.exists) {
          file.delete();
        }
        const updated = downloads.filter((d) => d.id !== download.id);
        setDownloads(updated);
        await AsyncStorage.setItem(DOWNLOADS_KEY, JSON.stringify(updated));
        const ids = new Set(updated.map((d) => d.sourceId || d.id));
        setDownloadedIds(ids);
        const size = updated.reduce((acc, d) => acc + d.fileSize, 0);
        setTotalDownloadSize(size);
      } catch (error) {
        console.error("Error removing download:", error);
      }
    },
    [downloads]
  );

  const handleMarkEpisodeComplete = useCallback(
    async (episode: SavedEpisode, isComplete: boolean) => {
      queryClient.setQueryData(["savedEpisodes"], (old: SavedEpisode[] | undefined) => {
        if (!old) return old;
        return old.map((e) =>
          e.id === episode.id ? { ...e, is_completed: isComplete } : e
        );
      });
      showToast(isComplete ? "Marked as complete" : "Marked as unfinished", "success");

      try {
        const { error } = await supabase
          .from("saved_episodes")
          .update({ is_completed: isComplete })
          .eq("id", episode.id);
        if (error) throw error;
      } catch (error) {
        console.error("Error updating episode:", error);
        queryClient.setQueryData(["savedEpisodes"], (old: SavedEpisode[] | undefined) => {
          if (!old) return old;
          return old.map((e) =>
            e.id === episode.id ? { ...e, is_completed: !isComplete } : e
          );
        });
        showToast("Failed to update", "error");
      }
    },
    [queryClient, showToast]
  );

  const handleMarkBriefComplete = useCallback(
    async (brief: UserBrief, isComplete: boolean) => {
      queryClient.setQueryData(["userBriefs"], (old: UserBrief[] | undefined) => {
        if (!old) return old;
        return old.map((b) =>
          b.id === brief.id ? { ...b, is_completed: isComplete } : b
        );
      });
      showToast(isComplete ? "Marked as complete" : "Marked as unfinished", "success");

      try {
        const { error } = await supabase
          .from("user_briefs")
          .update({ is_completed: isComplete })
          .eq("id", brief.id);
        if (error) throw error;
      } catch (error) {
        console.error("Error updating brief:", error);
        queryClient.setQueryData(["userBriefs"], (old: UserBrief[] | undefined) => {
          if (!old) return old;
          return old.map((b) =>
            b.id === brief.id ? { ...b, is_completed: !isComplete } : b
          );
        });
        showToast("Failed to update", "error");
      }
    },
    [queryClient, showToast]
  );

  const handleSummarizeEpisode = useCallback(
    (episode: SavedEpisode) => {
      (navigation as any).navigate("EpisodeDetail", {
        episode,
        source: "library",
        autoSummarize: true,
      });
    },
    [navigation]
  );

  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set());

  const handleDownloadEpisode = useCallback(
    async (episode: SavedEpisode) => {
      if (!episode.episode_audio_url) {
        Alert.alert("Error", "No audio available to download");
        return;
      }

      setDownloadingIds((prev) => new Set(prev).add(episode.id));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      try {
        const docDir = Paths.document;
        const fileName = `episode_${episode.taddy_episode_uuid}.mp3`;
        const downloadDir = new Directory(docDir, "downloads");

        if (!downloadDir.exists) {
          downloadDir.create();
        }

        const downloadedFile = new File(downloadDir, fileName);

        const response = await fetch(episode.episode_audio_url);
        if (!response.ok) throw new Error("Download failed");

        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();
        downloadedFile.write(new Uint8Array(arrayBuffer));

        const fileSize = blob.size || 0;

        const downloadData: Download = {
          id: `episode-${episode.taddy_episode_uuid}`,
          type: "episode",
          title: episode.episode_name,
          podcast: episode.podcast_name,
          artwork: episode.episode_thumbnail,
          filePath: downloadedFile.uri,
          fileSize: fileSize,
          downloadedAt: new Date().toISOString(),
          sourceId: episode.id,
          taddyEpisodeUuid: episode.taddy_episode_uuid,
          taddyPodcastUuid: episode.taddy_podcast_uuid,
          episodeDurationSeconds: episode.episode_duration_seconds || undefined,
          episodePublishedAt: episode.episode_published_at || undefined,
          audioUrl: episode.episode_audio_url,
        };

        const updated = [...downloads.filter((d) => d.id !== downloadData.id), downloadData];
        setDownloads(updated);
        await AsyncStorage.setItem(DOWNLOADS_KEY, JSON.stringify(updated));
        setDownloadedIds(new Set(updated.map((d) => d.sourceId || d.taddyEpisodeUuid || d.id)));
        setTotalDownloadSize(updated.reduce((acc, d) => acc + d.fileSize, 0));

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert("Downloaded", `"${episode.episode_name}" saved for offline listening.`);
      } catch (error) {
        console.error("Download error:", error);
        Alert.alert("Download Failed", "Unable to download this episode.");
      } finally {
        setDownloadingIds((prev) => {
          const next = new Set(prev);
          next.delete(episode.id);
          return next;
        });
      }
    },
    [downloads]
  );

  const handleDownloadBrief = useCallback(
    async (brief: UserBrief) => {
      if (!brief.master_brief?.audio_url) {
        Alert.alert("Error", "No audio available to download");
        return;
      }

      setDownloadingIds((prev) => new Set(prev).add(brief.id));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      try {
        const docDir = Paths.document;
        const fileName = `summary_${brief.master_brief_id}.mp3`;
        const downloadDir = new Directory(docDir, "downloads");

        if (!downloadDir.exists) {
          downloadDir.create();
        }

        const downloadedFile = new File(downloadDir, fileName);

        const response = await fetch(brief.master_brief.audio_url);
        if (!response.ok) throw new Error("Download failed");

        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();
        downloadedFile.write(new Uint8Array(arrayBuffer));

        const fileSize = blob.size || 0;

        const downloadData: Download = {
          id: `summary-${brief.master_brief_id}`,
          type: "summary",
          title: brief.master_brief.episode_name || "Summary",
          podcast: brief.master_brief.podcast_name || "",
          artwork: brief.master_brief.episode_thumbnail,
          filePath: downloadedFile.uri,
          fileSize: fileSize,
          downloadedAt: new Date().toISOString(),
          sourceId: brief.id,
          episodeDurationSeconds: brief.master_brief.audio_duration_seconds || undefined,
          audioUrl: brief.master_brief.audio_url,
        };

        const updated = [...downloads.filter((d) => d.id !== downloadData.id), downloadData];
        setDownloads(updated);
        await AsyncStorage.setItem(DOWNLOADS_KEY, JSON.stringify(updated));
        setDownloadedIds(new Set(updated.map((d) => d.sourceId || d.id)));
        setTotalDownloadSize(updated.reduce((acc, d) => acc + d.fileSize, 0));

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert("Downloaded", "Summary saved for offline listening.");
      } catch (error) {
        console.error("Download error:", error);
        Alert.alert("Download Failed", "Unable to download this summary.");
      } finally {
        setDownloadingIds((prev) => {
          const next = new Set(prev);
          next.delete(brief.id);
          return next;
        });
      }
    },
    [downloads]
  );

  const handleRemoveEpisodeDownload = useCallback(
    async (episode: SavedEpisode) => {
      const download = downloads.find(
        (d) => d.sourceId === episode.id || d.taddyEpisodeUuid === episode.taddy_episode_uuid
      );
      if (download) {
        await handleRemoveDownload(download);
      }
    },
    [downloads, handleRemoveDownload]
  );

  const handleRemoveBriefDownload = useCallback(
    async (brief: UserBrief) => {
      const download = downloads.find((d) => d.sourceId === brief.id);
      if (download) {
        await handleRemoveDownload(download);
      }
    },
    [downloads, handleRemoveDownload]
  );

  const segments = [
    { key: "episodes" as TabType, label: "Episodes" },
    { key: "summaries" as TabType, label: "Summaries" },
    { key: "downloads" as TabType, label: "Downloads" },
  ];

  const isEpisodeDownloaded = (episode: SavedEpisode): boolean => {
    return downloadedIds.has(episode.id) || downloadedIds.has(episode.taddy_episode_uuid);
  };

  const isBriefDownloaded = (brief: UserBrief): boolean => {
    return downloadedIds.has(brief.id) || downloadedIds.has(brief.master_brief_id);
  };

  const renderEmptyState = () => {
    let icon: string = "bookmark";
    let title = "No Saved Episodes";
    let subtitle = "Save episodes from shows you follow to listen later";

    if (selectedTab === "summaries") {
      icon = "zap";
      title = "No Summaries Yet";
      subtitle = "Generate AI summaries from any podcast episode";
    } else if (selectedTab === "downloads") {
      icon = "download";
      title = "No Downloads";
      subtitle = "Download summaries and episodes to listen offline";
    }

    return (
      <View style={styles.emptyContainer}>
        <Feather name={icon as any} size={48} color={theme.textTertiary} />
        <ThemedText type="body" style={[styles.emptyTitle, { color: theme.textSecondary }]}>
          {title}
        </ThemedText>
        <ThemedText type="caption" style={[styles.emptySubtitle, { color: theme.textTertiary }]}>
          {subtitle}
        </ThemedText>
      </View>
    );
  };

  const renderItem = ({ item }: { item: SavedEpisode | UserBrief | Download }) => {
    if (selectedTab === "episodes") {
      const episode = item as SavedEpisode;
      return (
        <LibraryItemCard
          type="episode"
          episode={episode}
          isDownloaded={isEpisodeDownloaded(episode)}
          isDownloading={downloadingIds.has(episode.id)}
          onPlay={() => handlePlayEpisode(episode)}
          onDownload={() => handleDownloadEpisode(episode)}
          onRemoveDownload={() => handleRemoveEpisodeDownload(episode)}
          onRemoveFromPlaylist={() => handleRemoveEpisode(episode)}
          onMarkComplete={(isComplete) => handleMarkEpisodeComplete(episode, isComplete)}
          onSummarize={() => handleSummarizeEpisode(episode)}
        />
      );
    } else if (selectedTab === "summaries") {
      const brief = item as UserBrief;
      return (
        <LibraryItemCard
          type="summary"
          brief={brief}
          isDownloaded={isBriefDownloaded(brief)}
          isDownloading={downloadingIds.has(brief.id)}
          onPlay={() => handlePlayBrief(brief)}
          onDownload={() => handleDownloadBrief(brief)}
          onRemoveDownload={() => handleRemoveBriefDownload(brief)}
          onRemoveFromPlaylist={() => handleRemoveBrief(brief)}
          onMarkComplete={(isComplete) => handleMarkBriefComplete(brief, isComplete)}
        />
      );
    } else {
      const download = item as Download;
      return (
        <LibraryItemCard
          type="download"
          download={download}
          isDownloaded={true}
          onPlay={() => handlePlayDownload(download)}
          onRemoveFromPlaylist={() => handleRemoveDownload(download)}
          onRemoveDownload={() => handleRemoveDownload(download)}
          onSummarize={download.type === "episode" ? () => {
            if (download.taddyEpisodeUuid) {
              (navigation as any).navigate("EpisodeDetail", {
                episode: {
                  taddy_episode_uuid: download.taddyEpisodeUuid,
                  taddy_podcast_uuid: download.taddyPodcastUuid,
                  episode_name: download.title,
                  podcast_name: download.podcast,
                  episode_thumbnail: download.artwork,
                  episode_audio_url: download.audioUrl,
                  episode_duration_seconds: download.episodeDurationSeconds,
                },
                source: "downloads",
                autoSummarize: true,
              });
            }
          } : undefined}
        />
      );
    }
  };

  const getData = () => {
    if (selectedTab === "episodes") return savedEpisodes || [];
    if (selectedTab === "summaries") return userBriefs || [];
    return downloads;
  };

  const getKeyExtractor = (item: SavedEpisode | UserBrief | Download) => item.id;

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <FlatList
        data={getData()}
        keyExtractor={getKeyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={
          <View style={styles.header}>
            <ThemedText type="pageTitle" style={styles.title}>
              {profile?.first_name ? `${profile.first_name}'s Library` : "Your Library"}
            </ThemedText>
            <ThemedText type="caption" style={[styles.subtitle, { color: theme.textSecondary }]}>
              Your saved episodes, AI summaries, and downloads
            </ThemedText>
            <SegmentedControl
              segments={segments}
              selectedKey={selectedTab}
              onSelect={setSelectedTab}
            />
            {selectedTab === "downloads" && downloads.length > 0 ? (
              <View style={[styles.storageBar, { backgroundColor: theme.backgroundDefault }]}>
                <Feather name="download-cloud" size={18} color={theme.gold} />
                <ThemedText type="small" style={styles.storageText}>
                  {formatFileSize(totalDownloadSize)} used
                </ThemedText>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={renderEmptyState}
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
  storageBar: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
  },
  storageText: {
    marginLeft: Spacing.sm,
    fontWeight: "500",
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
