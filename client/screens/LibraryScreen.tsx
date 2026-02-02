import React, { useState, useCallback, useEffect, useMemo } from "react";
import { FlatList, View, StyleSheet, RefreshControl, Alert, TextInput, Pressable, Platform } from "react-native";
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

type FilterType = "unfinished" | "completed" | "all";

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
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<FilterType>("unfinished");
  const [filterMenuVisible, setFilterMenuVisible] = useState(false);
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set());

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

  const preferredLanguage = profile?.preferred_language || "en";

  const {
    data: userBriefs,
    isLoading: isLoadingBriefs,
    refetch: refetchBriefs,
  } = useQuery({
    queryKey: ["userBriefs", preferredLanguage],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("user_briefs")
        .select(
          `
          *,
          master_brief:master_briefs!inner(
            id,
            taddy_episode_uuid,
            episode_name,
            podcast_name,
            episode_thumbnail,
            summary_text,
            audio_url,
            audio_duration_seconds,
            pipeline_status,
            language
          )
        `
        )
        .eq("user_id", user.id)
        .eq("is_hidden", false)
        .eq("master_brief.language", preferredLanguage)
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
      if (removingIds.has(episode.id)) return;
      
      setRemovingIds(prev => new Set(prev).add(episode.id));
      try {
        const { error } = await supabase
          .from("saved_episodes")
          .delete()
          .eq("id", episode.id);
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ["savedEpisodes"] });
        queryClient.invalidateQueries({ queryKey: ["savedEpisodes", "uuidsOnly"] });
        showToast("Episode removed from library", "info");
      } catch (error) {
        console.error("Error removing episode:", error);
        showToast("Failed to remove episode", "error");
      } finally {
        setRemovingIds(prev => {
          const next = new Set(prev);
          next.delete(episode.id);
          return next;
        });
      }
    },
    [queryClient, removingIds, showToast]
  );

  const handleRemoveBrief = useCallback(
    async (brief: UserBrief) => {
      if (removingIds.has(brief.id)) return;
      
      setRemovingIds(prev => new Set(prev).add(brief.id));
      try {
        const { error } = await supabase
          .from("user_briefs")
          .update({ is_hidden: true })
          .eq("id", brief.id);
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ["userBriefs"] });
        showToast("Summary removed from library", "info");
      } catch (error) {
        console.error("Error removing brief:", error);
        showToast("Failed to remove summary", "error");
      } finally {
        setRemovingIds(prev => {
          const next = new Set(prev);
          next.delete(brief.id);
          return next;
        });
      }
    },
    [queryClient, removingIds, showToast]
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
      showToast(isComplete ? "Marked as complete" : "Marked as unfinished", isComplete ? "success" : "info");

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
      showToast(isComplete ? "Marked as complete" : "Marked as unfinished", isComplete ? "success" : "info");

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
      if (!brief.master_brief_id) {
        Alert.alert("Error", "No audio available to download");
        return;
      }

      setDownloadingIds((prev) => new Set(prev).add(brief.id));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      try {
        const { data: signedData, error: signedError } = await supabase.functions.invoke(
          "get-signed-audio-url",
          { body: { masterBriefId: brief.master_brief_id } }
        );
        if (signedError || !signedData?.signedUrl) {
          throw new Error("Failed to get signed URL");
        }

        const docDir = Paths.document;
        const fileName = `summary_${brief.master_brief_id}.mp3`;
        const downloadDir = new Directory(docDir, "downloads");

        if (!downloadDir.exists) {
          downloadDir.create();
        }

        const downloadedFile = new File(downloadDir, fileName);

        const response = await fetch(signedData.signedUrl);
        if (!response.ok) throw new Error("Download failed");

        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();
        downloadedFile.write(new Uint8Array(arrayBuffer));

        const fileSize = blob.size || 0;

        const downloadData: Download = {
          id: `summary-${brief.master_brief_id}`,
          type: "summary",
          title: brief.master_brief?.episode_name || "Summary",
          podcast: brief.master_brief?.podcast_name || "",
          artwork: brief.master_brief?.episode_thumbnail || null,
          filePath: downloadedFile.uri,
          fileSize: fileSize,
          downloadedAt: new Date().toISOString(),
          sourceId: brief.id,
          episodeDurationSeconds: brief.master_brief?.audio_duration_seconds || undefined,
          audioUrl: downloadedFile.uri,
          masterBriefId: brief.master_brief_id,
          slug: brief.slug,
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

  const summarizedEpisodeIds = useMemo(() => {
    const ids = new Set<string>();
    if (userBriefs) {
      for (const brief of userBriefs) {
        if (brief.master_brief?.taddy_episode_uuid) {
          ids.add(brief.master_brief.taddy_episode_uuid);
        }
      }
    }
    return ids;
  }, [userBriefs]);

  const hasSummaryForEpisode = (episode: SavedEpisode): boolean => {
    return summarizedEpisodeIds.has(episode.taddy_episode_uuid);
  };

  const hasSummaryForDownload = (download: Download): boolean => {
    if (download.type !== "episode" || !download.taddyEpisodeUuid) return false;
    return summarizedEpisodeIds.has(download.taddyEpisodeUuid);
  };

  const getFilteredData = useMemo(() => {
    let data: (SavedEpisode | UserBrief | Download)[] = [];
    
    if (selectedTab === "episodes") {
      data = savedEpisodes || [];
    } else if (selectedTab === "summaries") {
      data = userBriefs || [];
    } else {
      data = downloads;
    }

    if (filter !== "all" && selectedTab !== "downloads") {
      data = data.filter((item) => {
        const isCompleted = selectedTab === "episodes"
          ? (item as SavedEpisode).is_completed
          : (item as UserBrief).is_completed;
        return filter === "completed" ? isCompleted : !isCompleted;
      });
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      data = data.filter((item) => {
        let title = "";
        let podcast = "";
        
        if (selectedTab === "episodes") {
          const ep = item as SavedEpisode;
          title = ep.episode_name || "";
          podcast = ep.podcast_name || "";
        } else if (selectedTab === "summaries") {
          const br = item as UserBrief;
          title = br.master_brief?.episode_name || "";
          podcast = br.master_brief?.podcast_name || "";
        } else {
          const dl = item as Download;
          title = dl.title || "";
          podcast = dl.podcast || "";
        }
        
        return title.toLowerCase().includes(query) || podcast.toLowerCase().includes(query);
      });
    }

    return data;
  }, [selectedTab, savedEpisodes, userBriefs, downloads, filter, searchQuery]);

  const filterLabels: Record<FilterType, string> = {
    unfinished: "Unfinished",
    completed: "Completed",
    all: "All",
  };

  const renderEmptyState = () => {
    if (searchQuery.trim()) {
      return (
        <View style={styles.emptyContainer}>
          <Feather name="search" size={48} color={theme.textTertiary} />
          <ThemedText type="body" style={[styles.emptyTitle, { color: theme.textSecondary }]}>
            No Results
          </ThemedText>
          <ThemedText type="caption" style={[styles.emptySubtitle, { color: theme.textTertiary }]}>
            Try a different search term
          </ThemedText>
        </View>
      );
    }

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

    if (filter === "completed" && selectedTab !== "downloads") {
      title = `No Completed ${selectedTab === "episodes" ? "Episodes" : "Summaries"}`;
      subtitle = "Items you mark as complete will appear here";
    } else if (filter === "unfinished" && selectedTab !== "downloads") {
      title = `No Unfinished ${selectedTab === "episodes" ? "Episodes" : "Summaries"}`;
      subtitle = "Great job! You've finished everything";
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
          isRemoving={removingIds.has(episode.id)}
          hasSummary={hasSummaryForEpisode(episode)}
          onPlay={() => handlePlayEpisode(episode)}
          onNavigateToDetails={() => {
            (navigation as any).navigate("EpisodeDetail", {
              episode,
              source: "library",
            });
          }}
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
          isRemoving={removingIds.has(brief.id)}
          onPlay={() => handlePlayBrief(brief)}
          onNavigateToDetails={() => {
            (navigation as any).navigate("BriefDetail", {
              brief,
              source: "library",
            });
          }}
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
          hasSummary={hasSummaryForDownload(download)}
          onPlay={() => handlePlayDownload(download)}
          onNavigateToDetails={() => {
            if (download.type === "episode" && download.taddyEpisodeUuid) {
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
              });
            } else if (download.type === "summary" && download.masterBriefId) {
              (navigation as any).navigate("BriefDetail", {
                brief: {
                  id: download.id,
                  master_brief_id: download.masterBriefId,
                  slug: download.slug,
                  master_brief: {
                    episode_name: download.title,
                    podcast_name: download.podcast,
                    episode_thumbnail: download.artwork,
                    audio_url: download.audioUrl,
                    audio_duration_seconds: download.episodeDurationSeconds,
                  },
                },
                source: "downloads",
              });
            }
          }}
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

  const getKeyExtractor = (item: SavedEpisode | UserBrief | Download, index: number) => {
    const id = item.id || `fallback-${index}`;
    if (selectedTab === "episodes") return `episode-${id}`;
    if (selectedTab === "summaries") return `summary-${id}`;
    return `download-${id}`;
  };

  const getSearchPlaceholder = () => {
    if (selectedTab === "episodes") return "Search episodes...";
    if (selectedTab === "summaries") return "Search summaries...";
    return "Search downloads...";
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <FlatList
        data={getFilteredData}
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

            <View style={styles.searchFilterRow}>
              <View
                style={[
                  styles.searchContainer,
                  {
                    backgroundColor: theme.backgroundSecondary,
                    borderColor: theme.border,
                  },
                ]}
              >
                <Feather name="search" size={16} color={theme.textTertiary} />
                <TextInput
                  style={[styles.searchInput, { color: theme.text }]}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder={getSearchPlaceholder()}
                  placeholderTextColor={theme.textTertiary}
                  returnKeyType="search"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {searchQuery.length > 0 ? (
                  <Pressable onPress={() => setSearchQuery("")} style={styles.clearButton}>
                    <Feather name="x" size={16} color={theme.textTertiary} />
                  </Pressable>
                ) : null}
              </View>

              {selectedTab !== "downloads" ? (
                <Pressable
                  onPress={() => setFilterMenuVisible(true)}
                  style={[
                    styles.filterButton,
                    {
                      backgroundColor: theme.backgroundSecondary,
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <ThemedText type="caption" style={{ color: theme.text }}>
                    {filterLabels[filter]}
                  </ThemedText>
                  <Feather name="chevron-down" size={14} color={theme.textSecondary} />
                </Pressable>
              ) : null}
            </View>

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

      {filterMenuVisible ? (
        <Pressable
          style={styles.filterOverlay}
          onPress={() => setFilterMenuVisible(false)}
        >
          <View style={[styles.filterMenu, { backgroundColor: theme.backgroundDefault }]}>
            <View style={[styles.filterHeader, { borderBottomColor: theme.border }]}>
              <ThemedText type="small" style={{ color: theme.textSecondary, fontWeight: "600" }}>
                Filter Library By:
              </ThemedText>
            </View>
            {(["unfinished", "completed", "all"] as FilterType[]).map((option) => (
              <Pressable
                key={option}
                style={[
                  styles.filterOption,
                  filter === option && { backgroundColor: theme.backgroundTertiary },
                ]}
                onPress={() => {
                  setFilter(option);
                  setFilterMenuVisible(false);
                }}
              >
                <ThemedText
                  type="body"
                  style={{ color: filter === option ? theme.gold : theme.text }}
                >
                  {filterLabels[option]}
                </ThemedText>
                {filter === option ? (
                  <Feather name="check" size={18} color={theme.gold} />
                ) : null}
              </Pressable>
            ))}
          </View>
        </Pressable>
      ) : null}
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
  searchFilterRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  searchContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    height: 36,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    marginLeft: Spacing.xs,
    fontSize: 14,
    ...Platform.select({
      web: {
        outlineStyle: "none",
      } as any,
    }),
  },
  clearButton: {
    padding: 4,
  },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    height: 36,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    gap: 4,
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
    marginTop: Spacing.md,
    textAlign: "center",
  },
  emptySubtitle: {
    marginTop: Spacing.xs,
    textAlign: "center",
    paddingHorizontal: Spacing.xl,
  },
  filterOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    alignItems: "center",
  },
  filterMenu: {
    width: 200,
    borderRadius: BorderRadius.md,
    overflow: "hidden",
  },
  filterOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  filterHeader: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
