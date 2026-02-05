import React, { useState, useCallback, useEffect, useMemo } from "react";
import { FlatList, View, StyleSheet, RefreshControl, Alert, TextInput, Pressable, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation, useFocusEffect, useRoute } from "@react-navigation/native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Paths, Directory, File } from "expo-file-system";
import { createDownloadResumable } from "expo-file-system/legacy";
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
import { useNetwork } from "@/contexts/NetworkContext";

const DOWNLOADS_KEY = "@podbrief_downloads";

type FilterType = "unfinished" | "completed" | "downloaded";

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
  const route = useRoute();
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();
  const { play, playWithQueue, pause, resume, currentItem, isPlaying, isLoading } = useAudioPlayerContext();
  const { showToast } = useToast();
  const { isOnline } = useNetwork();

  const initialTab = (route.params as any)?.initialTab as TabType | undefined;
  const [selectedTab, setSelectedTab] = useState<TabType>(initialTab || "episodes");
  const [refreshing, setRefreshing] = useState(false);
  const [downloads, setDownloads] = useState<Download[]>([]);
  const [downloadedIds, setDownloadedIds] = useState<Set<string>>(new Set());
  const [totalDownloadSize, setTotalDownloadSize] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<FilterType>("unfinished");
  const [filterMenuVisible, setFilterMenuVisible] = useState(false);
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set());
  const [downloadProgress, setDownloadProgress] = useState<Map<string, number>>(new Map());
  const [retryingIds, setRetryingIds] = useState<Set<string>>(new Set());

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

  const isEpisodeDownloaded = useCallback((episode: SavedEpisode): boolean => {
    return downloadedIds.has(episode.id) || downloadedIds.has(episode.taddy_episode_uuid);
  }, [downloadedIds]);

  const isBriefDownloaded = useCallback((brief: UserBrief): boolean => {
    return downloadedIds.has(brief.id) || downloadedIds.has(brief.master_brief_id);
  }, [downloadedIds]);

  useEffect(() => {
    loadDownloads();
  }, [loadDownloads]);

  // Handle navigation with initialTab param
  useFocusEffect(
    useCallback(() => {
      if (initialTab && initialTab !== selectedTab) {
        setSelectedTab(initialTab);
      }
    }, [initialTab])
  );

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
            ai_condensed_transcript,
            transcript_content,
            audio_url,
            audio_duration_seconds,
            total_duration_minutes,
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
    try {
      await Promise.all([refetchEpisodes(), refetchBriefs(), loadDownloads()]);
    } catch (error) {
      console.error("[LibraryScreen] Error refreshing:", error);
    } finally {
      setRefreshing(false);
    }
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

  // Auto-refresh when there are processing summaries (poll every 15 seconds)
  useEffect(() => {
    const hasProcessingSummaries = userBriefs?.some(
      (brief) =>
        brief.master_brief?.pipeline_status &&
        brief.master_brief.pipeline_status !== "completed" &&
        brief.master_brief.pipeline_status !== "failed"
    );

    if (!hasProcessingSummaries) return;

    const intervalId = setInterval(() => {
      refetchBriefs();
    }, 15000);

    return () => clearInterval(intervalId);
  }, [userBriefs, refetchBriefs]);

  const handlePlayEpisode = useCallback(
    (episode: SavedEpisode, allEpisodes: SavedEpisode[]) => {
      if (currentItem?.id === episode.taddy_episode_uuid && currentItem?.type === "episode") {
        resume();
        return;
      }
      const audioItem: AudioItem = {
        id: episode.taddy_episode_uuid,
        type: "episode",
        title: episode.episode_name,
        podcast: episode.podcast_name,
        artwork: episode.episode_thumbnail,
        audioUrl: episode.episode_audio_url || "",
        duration: (episode.episode_duration_seconds || 0) * 1000,
        progress: (episode.audio_progress_seconds || 0) * 1000,
        savedEpisodeId: episode.id,
      };
      
      const currentIndex = allEpisodes.findIndex(e => e.id === episode.id);
      let remainingEpisodes = allEpisodes.slice(currentIndex + 1);
      
      if (!isOnline) {
        remainingEpisodes = remainingEpisodes.filter(ep => isEpisodeDownloaded(ep));
      }
      
      const queueItems: AudioItem[] = remainingEpisodes.map(ep => ({
        id: ep.taddy_episode_uuid,
        type: "episode" as const,
        title: ep.episode_name,
        podcast: ep.podcast_name,
        artwork: ep.episode_thumbnail,
        audioUrl: ep.episode_audio_url || "",
        duration: (ep.episode_duration_seconds || 0) * 1000,
        progress: (ep.audio_progress_seconds || 0) * 1000,
        savedEpisodeId: ep.id,
      }));
      
      playWithQueue(audioItem, queueItems);
    },
    [playWithQueue, resume, currentItem, isOnline, isEpisodeDownloaded]
  );

  const handlePlayBrief = useCallback(
    (brief: UserBrief, allBriefs: UserBrief[]) => {
      if (!brief.master_brief || brief.master_brief.pipeline_status !== "completed") {
        return;
      }
      if (currentItem?.masterBriefId === brief.master_brief_id && currentItem?.type === "summary") {
        resume();
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
      
      const currentIndex = allBriefs.findIndex(b => b.id === brief.id);
      let remainingBriefs = allBriefs.slice(currentIndex + 1).filter(
        b => b.master_brief?.pipeline_status === "completed"
      );
      
      if (!isOnline) {
        remainingBriefs = remainingBriefs.filter(b => isBriefDownloaded(b));
      }
      
      const queueItems: AudioItem[] = remainingBriefs.map(b => ({
        id: b.id,
        type: "summary" as const,
        title: b.master_brief?.episode_name || "Summary",
        podcast: b.master_brief?.podcast_name || "",
        artwork: b.master_brief?.episode_thumbnail || null,
        audioUrl: b.master_brief?.audio_url || "",
        duration: (b.master_brief?.audio_duration_seconds || 0) * 1000,
        progress: b.audio_progress_seconds * 1000,
        masterBriefId: b.master_brief_id,
        userBriefId: b.id,
      }));
      
      playWithQueue(audioItem, queueItems);
    },
    [playWithQueue, resume, currentItem, isOnline, isBriefDownloaded]
  );

  const handlePlayDownload = useCallback(
    (download: Download, allDownloads: Download[]) => {
      const downloadId = download.type === "episode" ? (download.taddyEpisodeUuid || download.id) : download.id;
      if (currentItem?.id === downloadId) {
        resume();
        return;
      }
      const audioItem: AudioItem = {
        id: downloadId,
        type: download.type,
        title: download.title,
        podcast: download.podcast,
        artwork: download.artwork,
        audioUrl: download.filePath,
        duration: (download.episodeDurationSeconds || 0) * 1000,
        progress: 0,
        masterBriefId: download.type === "summary" ? download.masterBriefId : undefined,
      };
      
      const currentIndex = allDownloads.findIndex(d => d.id === download.id);
      const remainingDownloads = allDownloads.slice(currentIndex + 1);
      const queueItems: AudioItem[] = remainingDownloads.map(d => {
        const dId = d.type === "episode" ? (d.taddyEpisodeUuid || d.id) : d.id;
        return {
          id: dId,
          type: d.type,
          title: d.title,
          podcast: d.podcast,
          artwork: d.artwork,
          audioUrl: d.filePath,
          duration: (d.episodeDurationSeconds || 0) * 1000,
          progress: 0,
          masterBriefId: d.type === "summary" ? d.masterBriefId : undefined,
        };
      });
      
      playWithQueue(audioItem, queueItems);
    },
    [playWithQueue, resume, currentItem]
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

  const handleDownloadEpisode = useCallback(
    async (episode: SavedEpisode) => {
      if (Platform.OS === "web") {
        Alert.alert("Downloads Unavailable", "Downloads are only available in the mobile app. Open PodBrief in Expo Go to download episodes for offline listening.");
        return;
      }

      if (!episode.episode_audio_url) {
        Alert.alert("Error", "No audio available to download");
        return;
      }

      setDownloadingIds((prev) => new Set(prev).add(episode.id));
      setDownloadProgress((prev) => new Map(prev).set(episode.id, 0));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      try {
        const docDir = Paths.document;
        const downloadDir = new Directory(docDir, "downloads");
        if (!downloadDir.exists) {
          downloadDir.create();
        }

        const fileName = `episode_${episode.taddy_episode_uuid}.mp3`;
        const fileUri = `${downloadDir.uri}/${fileName}`;

        const downloadResumable = createDownloadResumable(
          episode.episode_audio_url,
          fileUri,
          {},
          (downloadProgress) => {
            const progress = downloadProgress.totalBytesExpectedToWrite > 0
              ? downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite
              : 0;
            setDownloadProgress((prev) => new Map(prev).set(episode.id, progress));
          }
        );

        const result = await downloadResumable.downloadAsync();
        if (!result || result.status !== 200) {
          throw new Error("Download failed");
        }

        const downloadedFile = new File(downloadDir, fileName);
        const fileSize = downloadedFile.size || 0;

        const downloadData: Download = {
          id: `episode-${episode.taddy_episode_uuid}`,
          type: "episode",
          title: episode.episode_name,
          podcast: episode.podcast_name,
          artwork: episode.episode_thumbnail,
          filePath: fileUri,
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
        showToast("Downloaded for offline listening", "success");
      } catch (error) {
        console.error("Download error:", error);
        Alert.alert("Download Failed", "Unable to download this episode. Please try again.");
      } finally {
        setDownloadingIds((prev) => {
          const next = new Set(prev);
          next.delete(episode.id);
          return next;
        });
        setDownloadProgress((prev) => {
          const next = new Map(prev);
          next.delete(episode.id);
          return next;
        });
      }
    },
    [downloads, showToast]
  );

  const handleDownloadBrief = useCallback(
    async (brief: UserBrief) => {
      if (Platform.OS === "web") {
        Alert.alert("Downloads Unavailable", "Downloads are only available in the mobile app. Open PodBrief in Expo Go to download summaries for offline listening.");
        return;
      }

      if (!brief.master_brief_id) {
        Alert.alert("Error", "No audio available to download");
        return;
      }

      setDownloadingIds((prev) => new Set(prev).add(brief.id));
      setDownloadProgress((prev) => new Map(prev).set(brief.id, 0));
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
        const downloadDir = new Directory(docDir, "downloads");
        if (!downloadDir.exists) {
          downloadDir.create();
        }

        const fileName = `summary_${brief.master_brief_id}.mp3`;
        const fileUri = `${downloadDir.uri}/${fileName}`;

        const downloadResumable = createDownloadResumable(
          signedData.signedUrl,
          fileUri,
          {},
          (downloadProgress) => {
            const progress = downloadProgress.totalBytesExpectedToWrite > 0
              ? downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite
              : 0;
            setDownloadProgress((prev) => new Map(prev).set(brief.id, progress));
          }
        );

        const result = await downloadResumable.downloadAsync();
        if (!result || result.status !== 200) {
          throw new Error("Download failed");
        }

        const downloadedFile = new File(downloadDir, fileName);
        const fileSize = downloadedFile.size || 0;

        const downloadData: Download = {
          id: `summary-${brief.master_brief_id}`,
          type: "summary",
          title: brief.master_brief?.episode_name || "Summary",
          podcast: brief.master_brief?.podcast_name || "",
          artwork: brief.master_brief?.episode_thumbnail || null,
          filePath: fileUri,
          fileSize: fileSize,
          downloadedAt: new Date().toISOString(),
          sourceId: brief.id,
          episodeDurationSeconds: brief.master_brief?.audio_duration_seconds || undefined,
          audioUrl: fileUri,
          masterBriefId: brief.master_brief_id,
          slug: brief.slug,
        };

        const updated = [...downloads.filter((d) => d.id !== downloadData.id), downloadData];
        setDownloads(updated);
        await AsyncStorage.setItem(DOWNLOADS_KEY, JSON.stringify(updated));
        setDownloadedIds(new Set(updated.map((d) => d.sourceId || d.id)));
        setTotalDownloadSize(updated.reduce((acc, d) => acc + d.fileSize, 0));

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showToast("Summary downloaded for offline listening", "success");
      } catch (error) {
        console.error("Download error:", error);
        Alert.alert("Download Failed", "Unable to download this summary. Please try again.");
      } finally {
        setDownloadingIds((prev) => {
          const next = new Set(prev);
          next.delete(brief.id);
          return next;
        });
        setDownloadProgress((prev) => {
          const next = new Map(prev);
          next.delete(brief.id);
          return next;
        });
      }
    },
    [downloads, showToast]
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

  // Retry handler for failed briefs
  const handleRetryBrief = useCallback(
    async (brief: UserBrief) => {
      if (!brief.master_brief_id) return;
      
      const pipelineStatus = brief.master_brief?.pipeline_status;
      setRetryingIds((prev) => new Set(prev).add(brief.id));
      
      try {
        if (pipelineStatus === "failed") {
          // Transcript failed - retry transcript fetch
          const { data, error } = await supabase.functions.invoke("retry-taddy-transcript", {
            body: { masterBriefId: brief.master_brief_id },
          });
          
          if (error) throw error;
          
          if (data?.status === "not_available") {
            showToast("Transcript not available for this episode. Please try a different episode.", "error");
          } else {
            showToast("Retrying summary generation...", "info");
          }
        } else if (pipelineStatus === "summary_failed") {
          // Summary quality failed - regenerate summary
          const { error } = await supabase.functions.invoke("regenerate-summary", {
            body: { masterBriefId: brief.master_brief_id },
          });
          
          if (error) throw error;
          
          showToast("Regenerating summary...", "info");
        }
        
        // Refetch briefs to get updated status
        setTimeout(() => {
          refetchBriefs();
        }, 2000);
      } catch (error) {
        console.error("Retry error:", error);
        showToast("There was an issue retrying. Please try again.", "error");
      } finally {
        setRetryingIds((prev) => {
          const next = new Set(prev);
          next.delete(brief.id);
          return next;
        });
      }
    },
    [refetchBriefs, showToast]
  );

  // Auto-retry for stale transcripts (pending/transcribing for >2 minutes)
  useEffect(() => {
    if (!userBriefs) return;
    
    const staleBriefs = userBriefs.filter((brief) => {
      const status = brief.master_brief?.pipeline_status;
      if (status !== "pending" && status !== "transcribing") return false;
      
      const createdAt = new Date(brief.created_at).getTime();
      const ageMinutes = (Date.now() - createdAt) / 1000 / 60;
      
      return ageMinutes >= 2 && !retryingIds.has(brief.id);
    });
    
    // Auto-retry stale briefs (one at a time to avoid rate limits)
    if (staleBriefs.length > 0) {
      const briefToRetry = staleBriefs[0];
      console.log("[LibraryScreen] Auto-retrying stale brief:", briefToRetry.master_brief_id);
      
      supabase.functions.invoke("retry-taddy-transcript", {
        body: { masterBriefId: briefToRetry.master_brief_id },
      }).catch((err) => console.error("[LibraryScreen] Auto-retry error:", err));
    }
  }, [userBriefs, retryingIds]);

  const segments = [
    { key: "episodes" as TabType, label: "Episodes" },
    { key: "summaries" as TabType, label: "Summaries" },
  ];

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
    } else {
      data = userBriefs || [];
    }

    if (filter === "downloaded") {
      data = data.filter((item) => {
        if (selectedTab === "episodes") {
          return isEpisodeDownloaded(item as SavedEpisode);
        } else {
          return isBriefDownloaded(item as UserBrief);
        }
      });
    } else {
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
        } else {
          const br = item as UserBrief;
          title = br.master_brief?.episode_name || "";
          podcast = br.master_brief?.podcast_name || "";
        }
        
        return title.toLowerCase().includes(query) || podcast.toLowerCase().includes(query);
      });
    }

    return data;
  }, [selectedTab, savedEpisodes, userBriefs, downloads, filter, searchQuery]);

  const filterLabels: Record<FilterType, string> = {
    unfinished: "Unfinished",
    completed: "Completed",
    downloaded: "Downloaded",
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
    }

    if (filter === "completed") {
      title = `No Completed ${selectedTab === "episodes" ? "Episodes" : "Summaries"}`;
      subtitle = "Items you mark as complete will appear here";
    } else if (filter === "unfinished") {
      title = `No Unfinished ${selectedTab === "episodes" ? "Episodes" : "Summaries"}`;
      subtitle = "Great job! You've finished everything";
    } else if (filter === "downloaded") {
      title = `No Downloaded ${selectedTab === "episodes" ? "Episodes" : "Summaries"}`;
      subtitle = "Download items for offline listening";
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

  const isEpisodePlaying = useCallback((episode: SavedEpisode) => {
    const isActive = currentItem?.type === "episode" && currentItem?.id === episode.taddy_episode_uuid;
    return isActive && (isPlaying || isLoading);
  }, [isPlaying, isLoading, currentItem]);

  const isBriefPlaying = useCallback((brief: UserBrief) => {
    const isActive = currentItem?.type === "summary" && currentItem?.masterBriefId === brief.master_brief_id;
    return isActive && (isPlaying || isLoading);
  }, [isPlaying, isLoading, currentItem]);

  const isDownloadPlaying = useCallback((download: Download) => {
    let isActive = false;
    if (download.type === "episode") {
      isActive = currentItem?.type === "episode" && currentItem?.id === download.taddyEpisodeUuid;
    } else {
      isActive = currentItem?.type === "summary" && currentItem?.masterBriefId === download.masterBriefId;
    }
    return isActive && (isPlaying || isLoading);
  }, [isPlaying, isLoading, currentItem]);

  const renderItem = ({ item }: { item: SavedEpisode | UserBrief | Download }) => {
    if (selectedTab === "episodes") {
      const episode = item as SavedEpisode;
      const episodesList = getFilteredData as SavedEpisode[];
      return (
        <LibraryItemCard
          type="episode"
          episode={episode}
          isDownloaded={isEpisodeDownloaded(episode)}
          isOffline={!isOnline}
          isDownloading={downloadingIds.has(episode.id)}
          downloadProgress={downloadProgress.get(episode.id) || 0}
          isRemoving={removingIds.has(episode.id)}
          hasSummary={hasSummaryForEpisode(episode)}
          isPlaying={isEpisodePlaying(episode)}
          onPlay={() => handlePlayEpisode(episode, episodesList)}
          onPause={pause}
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
        />
      );
    } else if (selectedTab === "summaries") {
      const brief = item as UserBrief;
      const briefsList = getFilteredData as UserBrief[];
      const pipelineStatus = brief.master_brief?.pipeline_status;
      const isFailed = pipelineStatus === "failed" || pipelineStatus === "summary_failed";
      
      return (
        <LibraryItemCard
          type="summary"
          brief={brief}
          isDownloaded={isBriefDownloaded(brief)}
          isOffline={!isOnline}
          isDownloading={downloadingIds.has(brief.id)}
          downloadProgress={downloadProgress.get(brief.id) || 0}
          isRemoving={removingIds.has(brief.id)}
          isRetrying={retryingIds.has(brief.id)}
          isPlaying={isBriefPlaying(brief)}
          onPlay={() => handlePlayBrief(brief, briefsList)}
          onPause={pause}
          onNavigateToDetails={() => {
            // Block navigation if summary is not completed
            if (pipelineStatus && pipelineStatus !== "completed") {
              if (isFailed) {
                showToast("There was an issue generating your summary. Please retry.", "error");
              } else {
                showToast("Summary is still being generated. You'll be notified when it's ready.", "info");
              }
              return;
            }
            (navigation as any).navigate("BriefDetail", {
              brief,
              source: "library",
            });
          }}
          onDownload={() => handleDownloadBrief(brief)}
          onRemoveDownload={() => handleRemoveBriefDownload(brief)}
          onRemoveFromPlaylist={() => handleRemoveBrief(brief)}
          onMarkComplete={(isComplete) => handleMarkBriefComplete(brief, isComplete)}
          onRetry={isFailed ? () => handleRetryBrief(brief) : undefined}
        />
      );
    } else {
      const download = item as Download;
      const downloadsList = getFilteredData as Download[];
      return (
        <LibraryItemCard
          type="download"
          download={download}
          isDownloaded={true}
          hasSummary={hasSummaryForDownload(download)}
          isPlaying={isDownloadPlaying(download)}
          onPlay={() => handlePlayDownload(download, downloadsList)}
          onPause={pause}
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
            </View>
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
            {(["unfinished", "completed", "downloaded"] as FilterType[]).map((option) => (
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
