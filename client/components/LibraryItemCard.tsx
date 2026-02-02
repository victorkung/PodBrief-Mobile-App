import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Modal,
  Share,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "./ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAudioPlayerContext } from "@/contexts/AudioPlayerContext";
import { Spacing, BorderRadius } from "@/constants/theme";
import { SavedEpisode, UserBrief, Download } from "@/lib/types";

type ItemType = "episode" | "summary" | "download";

interface LibraryItemCardProps {
  type: ItemType;
  episode?: SavedEpisode;
  brief?: UserBrief;
  download?: Download;
  isDownloaded?: boolean;
  onPlay: () => void;
  onPause?: () => void;
  onNavigateToDetails?: () => void;
  onDownload?: () => void;
  onRemoveDownload?: () => void;
  onRemoveFromPlaylist: () => void;
  onMarkComplete?: (isComplete: boolean) => void;
  onSummarize?: () => void;
  isComplete?: boolean;
  isDownloading?: boolean;
  isRemoving?: boolean;
  hasSummary?: boolean;
  isPlaying?: boolean;
}

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return "";
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins} min`;
}

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "";
  const d = new Date(dateString);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function LibraryItemCard({
  type,
  episode,
  brief,
  download,
  isDownloaded = false,
  onPlay,
  onPause,
  onNavigateToDetails,
  onDownload,
  onRemoveDownload,
  onRemoveFromPlaylist,
  onMarkComplete,
  onSummarize,
  isComplete = false,
  isDownloading = false,
  isRemoving = false,
  hasSummary = false,
  isPlaying = false,
}: LibraryItemCardProps) {
  const { theme } = useTheme();
  const { isLoading: audioLoading, currentItem } = useAudioPlayerContext();
  const [menuVisible, setMenuVisible] = useState(false);

  // Check if this specific item is loading
  const isThisItemLoading = (() => {
    if (!audioLoading || !currentItem) return false;
    if (episode) {
      return currentItem.type === "episode" && currentItem.id === episode.taddy_episode_uuid;
    }
    if (brief) {
      return currentItem.type === "summary" && currentItem.masterBriefId === brief.master_brief_id;
    }
    if (download) {
      if (download.type === "episode") {
        return currentItem.type === "episode" && currentItem.id === download.taddyEpisodeUuid;
      }
      return currentItem.type === "summary" && currentItem.masterBriefId === download.masterBriefId;
    }
    return false;
  })();

  const getTitle = (): string => {
    if (episode) return episode.episode_name;
    if (brief?.master_brief) return brief.master_brief.episode_name || "Summary";
    if (download) return download.title;
    return "";
  };

  const getPodcastName = (): string => {
    if (episode) return episode.podcast_name;
    if (brief?.master_brief) return brief.master_brief.podcast_name || "";
    if (download) return download.podcast;
    return "";
  };

  const getArtwork = (): string | null => {
    if (episode) return episode.episode_thumbnail;
    if (brief?.master_brief) return brief.master_brief.episode_thumbnail;
    if (download) return download.artwork;
    return null;
  };

  const getDuration = (): string => {
    if (episode) return formatDuration(episode.episode_duration_seconds);
    if (brief?.master_brief) return formatDuration(brief.master_brief.audio_duration_seconds);
    if (download) return formatDuration(download.episodeDurationSeconds);
    return "";
  };

  const getDate = (): string => {
    if (episode) return formatDate(episode.episode_published_at);
    if (brief) return formatDate(brief.created_at);
    if (download) return formatDate(download.downloadedAt);
    return "";
  };

  const getCompleted = (): boolean => {
    if (episode) return episode.is_completed;
    if (brief) return brief.is_completed;
    return isComplete;
  };

  const handleShare = useCallback(async () => {
    try {
      let shareUrl = "";
      if (episode) {
        shareUrl = `https://podbrief.io/episode/${episode.taddy_episode_uuid}`;
      } else if (brief) {
        shareUrl = `https://podbrief.io/brief/${brief.slug}`;
      }
      if (shareUrl) {
        await Share.share({
          message: `Check out this on PodBrief: ${getTitle()} - ${shareUrl}`,
          url: shareUrl,
        });
      }
    } catch (error) {
      console.error("Share error:", error);
    }
  }, [episode, brief]);

  const handleToggleComplete = useCallback(() => {
    if (onMarkComplete) {
      onMarkComplete(!getCompleted());
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }, [onMarkComplete, getCompleted]);

  const handleRemove = useCallback(() => {
    if (isRemoving) return;
    setMenuVisible(false);
    Alert.alert(
      "Remove from Library",
      `Are you sure you want to remove "${getTitle()}" from your library?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            onRemoveFromPlaylist();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  }, [onRemoveFromPlaylist, getTitle, isRemoving]);

  const handleSummarize = useCallback(() => {
    setMenuVisible(false);
    if (onSummarize) {
      onSummarize();
    }
  }, [onSummarize]);

  const handleDownloadPress = useCallback(() => {
    if (isDownloaded && onRemoveDownload) {
      Alert.alert(
        "Remove Download",
        "Remove this download from your device?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Remove",
            style: "destructive",
            onPress: () => {
              onRemoveDownload();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            },
          },
        ]
      );
    } else if (onDownload) {
      onDownload();
    }
  }, [isDownloaded, onDownload, onRemoveDownload]);

  const showSummarizeOption = type === "episode" || (type === "download" && download?.type === "episode");
  const completed = getCompleted();
  const artwork = getArtwork();

  const showSummaryBadge = 
    (type === "episode" && hasSummary) || 
    (type === "download" && download?.type === "episode" && hasSummary);

  return (
    <View style={[styles.card, { borderBottomColor: theme.border }]}>
      <Pressable onPress={onNavigateToDetails || onPlay} style={styles.contentRow}>
        <View style={[styles.artwork, { backgroundColor: theme.backgroundTertiary }]}>
          {artwork ? (
            <Image source={{ uri: artwork }} style={styles.artworkImage} contentFit="cover" />
          ) : (
            <Feather
              name={type === "summary" ? "zap" : "headphones"}
              size={20}
              color={theme.textTertiary}
            />
          )}
          {showSummaryBadge ? (
            <View style={[styles.summaryBadge, { backgroundColor: theme.gold }]}>
              <Feather name="zap" size={8} color={theme.buttonText} />
            </View>
          ) : null}
          {completed ? (
            <View style={[styles.completedBadge, { backgroundColor: theme.gold }]}>
              <Feather name="check" size={8} color={theme.buttonText} />
            </View>
          ) : null}
        </View>

        <View style={styles.info}>
          <ThemedText type="small" numberOfLines={2} style={[styles.title, { color: theme.text }]}>
            {getTitle()}
          </ThemedText>
          <ThemedText type="caption" numberOfLines={1} style={{ color: theme.textSecondary }}>
            {getPodcastName()}
          </ThemedText>
          <View style={styles.metaRow}>
            <ThemedText type="caption" style={{ color: theme.textTertiary }}>
              {getDate()}
            </ThemedText>
            {getDuration() ? (
              <>
                <View style={[styles.dot, { backgroundColor: theme.textTertiary }]} />
                <ThemedText type="caption" style={{ color: theme.textTertiary }}>
                  {getDuration()}
                </ThemedText>
              </>
            ) : null}
            {type === "download" && download ? (
              <>
                <View style={[styles.dot, { backgroundColor: theme.textTertiary }]} />
                <ThemedText type="caption" style={{ color: theme.textTertiary }}>
                  {formatFileSize(download.fileSize)}
                </ThemedText>
              </>
            ) : null}
          </View>
        </View>
      </Pressable>

      <View style={styles.actionsRow}>
        <View style={styles.leftActions}>
          <Pressable
            onPress={handleToggleComplete}
            style={styles.actionButton}
          >
            {completed ? (
              <View style={[styles.completedCircle, { backgroundColor: theme.gold }]}>
                <Feather name="check" size={14} color={theme.buttonText} />
              </View>
            ) : (
              <Feather name="check" size={20} color={theme.textSecondary} />
            )}
          </Pressable>

          {type !== "download" ? (
            <Pressable
              onPress={handleDownloadPress}
              style={styles.actionButton}
              disabled={isDownloading}
            >
              <Feather
                name={isDownloaded ? "check-circle" : "download"}
                size={20}
                color={isDownloaded ? theme.gold : theme.textSecondary}
              />
            </Pressable>
          ) : null}

          <Pressable onPress={handleShare} style={styles.actionButton}>
            <Feather name="share" size={20} color={theme.textSecondary} />
          </Pressable>

          <Pressable
            onPress={() => setMenuVisible(true)}
            style={styles.actionButton}
          >
            <Feather name="more-horizontal" size={20} color={theme.textSecondary} />
          </Pressable>
        </View>

        <Pressable
          onPress={isPlaying ? onPause : onPlay}
          style={[styles.playButton, { backgroundColor: isPlaying ? theme.gold : theme.text }]}
          disabled={isThisItemLoading}
        >
          {isThisItemLoading ? (
            <ActivityIndicator size="small" color={theme.backgroundRoot} />
          ) : (
            <Feather name={isPlaying ? "pause" : "play"} size={18} color={theme.backgroundRoot} />
          )}
        </Pressable>
      </View>

      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setMenuVisible(false)}
        >
          <View style={[styles.menuContainer, { backgroundColor: theme.backgroundDefault }]}>
            {showSummarizeOption && onSummarize && !hasSummary ? (
              <Pressable
                style={styles.menuItem}
                onPress={handleSummarize}
              >
                <Feather name="zap" size={20} color={theme.text} />
                <ThemedText type="body" style={[styles.menuText, { color: theme.text }]}>
                  Summarize Episode
                </ThemedText>
              </Pressable>
            ) : null}

            <Pressable
              style={styles.menuItem}
              onPress={handleRemove}
            >
              <Feather name="trash-2" size={20} color={theme.text} />
              <ThemedText type="body" style={[styles.menuText, { color: theme.text }]}>
                Remove from Library
              </ThemedText>
            </Pressable>

            <Pressable
              style={[styles.menuItem, styles.cancelItem]}
              onPress={() => setMenuVisible(false)}
            >
              <ThemedText type="body" style={[styles.menuText, { color: theme.textSecondary }]}>
                Cancel
              </ThemedText>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  contentRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  artwork: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.xs,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  artworkImage: {
    width: "100%",
    height: "100%",
  },
  summaryBadge: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  completedBadge: {
    position: "absolute",
    top: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  info: {
    flex: 1,
    marginLeft: Spacing.md,
    justifyContent: "center",
  },
  title: {
    fontWeight: "600",
    marginBottom: 2,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    marginHorizontal: 6,
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  leftActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  completedCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  playButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingLeft: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  menuContainer: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg,
    paddingBottom: Spacing["2xl"],
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
  },
  menuText: {
    marginLeft: Spacing.md,
  },
  cancelItem: {
    justifyContent: "center",
    marginTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
    paddingTop: Spacing.lg,
  },
});
