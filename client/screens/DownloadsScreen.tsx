import React, { useState, useCallback, useEffect } from "react";
import { FlatList, View, StyleSheet, Pressable, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { File } from "expo-file-system";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { EmptyState } from "@/components/EmptyState";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

const emptyDownloadsImage = require("../../assets/images/empty-downloads.png");

interface Download {
  id: string;
  type: "summary" | "episode";
  title: string;
  podcast: string;
  artwork: string | null;
  filePath: string;
  fileSize: number;
  downloadedAt: string;
}

const DOWNLOADS_KEY = "@podbrief_downloads";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateString: string): string {
  const d = new Date(dateString);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function DownloadsScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();

  const [downloads, setDownloads] = useState<Download[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalSize, setTotalSize] = useState(0);

  const loadDownloads = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(DOWNLOADS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Download[];
        setDownloads(parsed);
        const size = parsed.reduce((acc, d) => acc + d.fileSize, 0);
        setTotalSize(size);
      }
    } catch (error) {
      console.error("Error loading downloads:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDownloads();
  }, [loadDownloads]);

  const handleDelete = useCallback(
    async (download: Download) => {
      Alert.alert(
        "Delete Download",
        `Are you sure you want to delete "${download.title}"?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              try {
                const file = new File(download.filePath);
                if (file.exists) {
                  file.delete();
                }
                const updated = downloads.filter((d) => d.id !== download.id);
                setDownloads(updated);
                await AsyncStorage.setItem(DOWNLOADS_KEY, JSON.stringify(updated));
                const size = updated.reduce((acc, d) => acc + d.fileSize, 0);
                setTotalSize(size);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              } catch (error) {
                console.error("Error deleting download:", error);
              }
            },
          },
        ]
      );
    },
    [downloads]
  );

  const renderItem = useCallback(
    ({ item }: { item: Download }) => (
      <Card
        style={{ ...styles.downloadCard, backgroundColor: theme.backgroundDefault } as any}
      >
        <View style={styles.downloadContent}>
          <View
            style={[
              styles.typeIcon,
              { backgroundColor: item.type === "summary" ? theme.gold : theme.backgroundTertiary },
            ]}
          >
            <Feather
              name={item.type === "summary" ? "zap" : "headphones"}
              size={16}
              color={item.type === "summary" ? theme.buttonText : theme.text}
            />
          </View>
          <View style={styles.downloadInfo}>
            <ThemedText type="h4" numberOfLines={1}>
              {item.title}
            </ThemedText>
            <ThemedText type="small" numberOfLines={1} style={{ color: theme.textSecondary }}>
              {item.podcast}
            </ThemedText>
            <View style={styles.metaRow}>
              <ThemedText type="caption" style={{ color: theme.textTertiary }}>
                {formatFileSize(item.fileSize)}
              </ThemedText>
              <View style={styles.dot} />
              <ThemedText type="caption" style={{ color: theme.textTertiary }}>
                {formatDate(item.downloadedAt)}
              </ThemedText>
            </View>
          </View>
          <Pressable
            onPress={() => handleDelete(item)}
            style={styles.deleteButton}
          >
            <Feather name="trash-2" size={18} color={theme.error} />
          </Pressable>
        </View>
      </Card>
    ),
    [theme, handleDelete]
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Feather name="download" size={48} color={theme.textTertiary} />
      <ThemedText type="body" style={[styles.emptyTitle, { color: theme.textSecondary }]}>
        No Downloads
      </ThemedText>
      <ThemedText type="caption" style={[styles.emptySubtitle, { color: theme.textTertiary }]}>
        Download summaries and episodes to listen offline
      </ThemedText>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <FlatList
        data={downloads}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={
          <View style={styles.header}>
            <ThemedText type="pageTitle" style={styles.title}>
              Downloads
            </ThemedText>
            <View
              style={[styles.storageBar, { backgroundColor: theme.backgroundDefault }]}
            >
              <Feather name="download-cloud" size={20} color={theme.gold} />
              <ThemedText type="body" style={styles.storageText}>
                {formatFileSize(totalSize)} used
              </ThemedText>
            </View>
          </View>
        }
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={{
          paddingTop: insets.top + Spacing.xl,
          paddingBottom: tabBarHeight + Spacing.miniPlayerHeight + Spacing.xl,
          paddingHorizontal: Spacing.lg,
          flexGrow: 1,
        }}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
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
    marginBottom: Spacing.md,
  },
  storageBar: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
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
  downloadCard: {
    marginBottom: Spacing.md,
    padding: Spacing.md,
  },
  downloadContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  typeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  downloadInfo: {
    flex: 1,
    marginLeft: Spacing.md,
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
    backgroundColor: "#6B7280",
    marginHorizontal: 6,
  },
  deleteButton: {
    padding: Spacing.sm,
  },
});
