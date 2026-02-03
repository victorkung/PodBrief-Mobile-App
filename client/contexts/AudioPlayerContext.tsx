import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  ReactNode,
  useCallback,
} from "react";
import { useAudioPlayer, useAudioPlayerStatus, AudioPlayer, setAudioModeAsync } from "expo-audio";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { AudioItem } from "@/lib/types";
import { Platform } from "react-native";

export type PlaybackState = "idle" | "loading" | "playing" | "paused" | "error";

export const SPEED_OPTIONS = [
  { value: 0.5, label: "0.5x" },
  { value: 0.75, label: "0.75x" },
  { value: 0.9, label: "0.9x" },
  { value: 1, label: "1x" },
  { value: 1.1, label: "1.1x" },
  { value: 1.25, label: "1.25x" },
  { value: 1.5, label: "1.5x" },
  { value: 1.75, label: "1.75x" },
  { value: 2, label: "2x" },
];

interface SavedProgress {
  currentTime: number;
  speed: number;
  savedAt: number;
}

interface EngagementSession {
  sessionId: string;
  startLogged: boolean;
  completionLogged: boolean;
  accumulatedListeningMs: number;
}

interface AudioPlayerContextType {
  currentItem: AudioItem | null;
  playbackState: PlaybackState;
  isPlaying: boolean;
  isLoading: boolean;
  position: number;
  duration: number;
  playbackSpeed: number;
  queue: AudioItem[];
  isExpanded: boolean;
  play: (item: AudioItem) => Promise<void>;
  playWithQueue: (item: AudioItem, queue: AudioItem[]) => Promise<void>;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  seekTo: (position: number) => void;
  skipForward: () => void;
  skipBackward: () => void;
  setSpeed: (speed: number) => void;
  addToQueue: (item: AudioItem) => void;
  removeFromQueue: (id: string) => void;
  clearQueue: () => void;
  playNext: () => void;
  setExpanded: (expanded: boolean) => void;
}

const AudioPlayerContext = createContext<AudioPlayerContextType | undefined>(
  undefined
);

const PROGRESS_KEY_PREFIX = "audio-progress-";
const SPEED_KEY = "audio-playback-speed";
const PROGRESS_EXPIRY_DAYS = 7;
const START_EVENT_THRESHOLD_MS = 30000; // Log start event after 30 seconds of accumulated listening
const COMPLETION_THRESHOLD = 0.75; // Log completion at 75% progress
const DB_SYNC_INTERVAL_MS = 15000; // Sync progress to database every 15 seconds

function generateSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function AudioPlayerProvider({ children }: { children: ReactNode }) {
  const player = useAudioPlayer("");
  const playerStatus = useAudioPlayerStatus(player);
  const queryClient = useQueryClient();
  const [currentItem, setCurrentItem] = useState<AudioItem | null>(null);
  const [playbackState, setPlaybackState] = useState<PlaybackState>("idle");
  
  const position = (playerStatus.currentTime || 0) * 1000;
  const duration = (playerStatus.duration || 0) * 1000;
  const [playbackSpeed, setPlaybackSpeedState] = useState(1);
  const [queue, setQueue] = useState<AudioItem[]>([]);
  const [isExpanded, setExpanded] = useState(false);
  const progressInterval = useRef<NodeJS.Timeout | null>(null);
  const saveProgressInterval = useRef<NodeJS.Timeout | null>(null);
  const lastSavedPosition = useRef(0);
  const engagementSession = useRef<EngagementSession | null>(null);
  const lastPositionForAccumulation = useRef(0);
  const dbSyncInterval = useRef<NodeJS.Timeout | null>(null);
  const lastDbSyncPosition = useRef(0);
  const autoplayTriggeredForItem = useRef<string | null>(null);
  const isAutoplayProcessing = useRef(false);
  const playRef = useRef<((item: AudioItem) => Promise<void>) | null>(null);

  const isPlaying = playbackState === "playing";
  const isLoading = playbackState === "loading";

  const getProgressKey = useCallback((item: AudioItem) => {
    if (item.type === "summary") {
      return `${PROGRESS_KEY_PREFIX}summary-${item.masterBriefId || item.id}`;
    }
    return `${PROGRESS_KEY_PREFIX}full_episode-${item.id}`;
  }, []);

  const loadSavedProgress = useCallback(async (item: AudioItem): Promise<SavedProgress | null> => {
    try {
      const key = getProgressKey(item);
      const saved = await AsyncStorage.getItem(key);
      if (saved) {
        const parsed: SavedProgress = JSON.parse(saved);
        const daysSinceSaved = (Date.now() - parsed.savedAt) / (1000 * 60 * 60 * 24);
        if (daysSinceSaved < PROGRESS_EXPIRY_DAYS) {
          return parsed;
        }
        await AsyncStorage.removeItem(key);
      }
    } catch (error) {
      console.error("[AudioPlayer] Error loading saved progress:", error);
    }
    return null;
  }, [getProgressKey]);

  const saveProgress = useCallback(async (item: AudioItem, currentTime: number, speed: number) => {
    try {
      const key = getProgressKey(item);
      const progress: SavedProgress = {
        currentTime,
        speed,
        savedAt: Date.now(),
      };
      await AsyncStorage.setItem(key, JSON.stringify(progress));
      lastSavedPosition.current = currentTime;
    } catch (error) {
      console.error("[AudioPlayer] Error saving progress:", error);
    }
  }, [getProgressKey]);

  const logEngagementEvent = useCallback(async (
    item: AudioItem,
    eventType: "start" | "completion",
    progressSeconds: number,
    durationSeconds: number,
    sessionId: string
  ) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const progressPercentage = durationSeconds > 0 
        ? Math.round((progressSeconds / durationSeconds) * 100) 
        : 0;

      await supabase.from("audio_engagement_events").insert({
        user_id: user.id,
        master_brief_id: item.masterBriefId || null,
        audio_type: item.type === "summary" ? "summary" : "full_episode",
        event_type: eventType,
        duration_seconds: Math.round(durationSeconds),
        progress_seconds: Math.round(progressSeconds),
        progress_percentage: progressPercentage,
        session_id: sessionId,
      });
      console.log(`[AudioPlayer] Logged ${eventType} event for session ${sessionId}`);
    } catch (error) {
      console.error("[AudioPlayer] Error logging engagement event:", error);
    }
  }, []);

  const syncProgressToDatabase = useCallback(async (item: AudioItem, progressMs: number, durationMs: number) => {
    try {
      const progressSeconds = Math.round(progressMs / 1000);
      const durationSeconds = Math.round(durationMs / 1000);
      const progressRatio = durationMs > 0 ? progressMs / durationMs : 0;
      const isCompleted = progressRatio >= COMPLETION_THRESHOLD;

      if (item.type === "summary" && item.userBriefId) {
        await supabase
          .from("user_briefs")
          .update({ 
            audio_progress_seconds: progressSeconds,
            is_completed: isCompleted,
            updated_at: new Date().toISOString(),
          })
          .eq("id", item.userBriefId);
      } else if (item.type === "episode" && item.savedEpisodeId) {
        await supabase
          .from("saved_episodes")
          .update({ 
            audio_progress_seconds: progressSeconds,
            is_completed: isCompleted,
            updated_at: new Date().toISOString(),
          })
          .eq("id", item.savedEpisodeId);
      }
      lastDbSyncPosition.current = progressMs;
    } catch (error) {
      console.error("[AudioPlayer] Error syncing progress to database:", error);
    }
  }, []);

  useEffect(() => {
    const loadSavedSpeed = async () => {
      try {
        const savedSpeed = await AsyncStorage.getItem(SPEED_KEY);
        if (savedSpeed) {
          setPlaybackSpeedState(parseFloat(savedSpeed));
        }
      } catch (error) {
        console.error("[AudioPlayer] Error loading saved speed:", error);
      }
    };
    loadSavedSpeed();
  }, []);

  useEffect(() => {
    const configureAudioMode = async () => {
      try {
        await setAudioModeAsync({
          playsInSilentMode: true,
          shouldPlayInBackground: true,
          interruptionMode: "doNotMix",
          interruptionModeAndroid: "doNotMix",
        });
        console.log("[AudioPlayer] Audio mode configured for background playback");
      } catch (error) {
        console.error("[AudioPlayer] Error configuring audio mode:", error);
      }
    };
    configureAudioMode();
  }, []);

  useEffect(() => {
    if (isPlaying) {
      progressInterval.current = setInterval(() => {
        const currentTimeMs = position;
        const durationMs = duration;

        if (currentItem && engagementSession.current && currentTimeMs > 0) {
          const timeDelta = currentTimeMs - lastPositionForAccumulation.current;
          if (timeDelta > 0 && timeDelta < 1000) {
            engagementSession.current.accumulatedListeningMs += timeDelta;
          }
          lastPositionForAccumulation.current = currentTimeMs;

          if (!engagementSession.current.startLogged && 
              engagementSession.current.accumulatedListeningMs >= START_EVENT_THRESHOLD_MS) {
            engagementSession.current.startLogged = true;
            logEngagementEvent(
              currentItem,
              "start",
              currentTimeMs / 1000,
              durationMs / 1000,
              engagementSession.current.sessionId
            );
          }

          const progressRatio = durationMs > 0 ? currentTimeMs / durationMs : 0;
          if (!engagementSession.current.completionLogged && progressRatio >= COMPLETION_THRESHOLD) {
            engagementSession.current.completionLogged = true;
            logEngagementEvent(
              currentItem,
              "completion",
              currentTimeMs / 1000,
              durationMs / 1000,
              engagementSession.current.sessionId
            );
            syncProgressToDatabase(currentItem, currentTimeMs, durationMs);
          }
        }
      }, 500);

      saveProgressInterval.current = setInterval(() => {
        if (currentItem && player.currentTime !== undefined) {
          const currentTimeMs = player.currentTime * 1000;
          // Only save if we've moved forward by at least 5 seconds and current position is at least 5 seconds
          if (currentTimeMs >= 5000 && Math.abs(currentTimeMs - lastSavedPosition.current) > 5000) {
            saveProgress(currentItem, currentTimeMs, playbackSpeed);
          }
        }
      }, 10000);

      dbSyncInterval.current = setInterval(() => {
        if (currentItem && player.currentTime !== undefined && player.duration !== undefined) {
          const currentTimeMs = player.currentTime * 1000;
          const durationMs = player.duration * 1000;
          // Only sync if we've moved forward by at least 5 seconds from last sync
          // and current position is at least 5 seconds (to avoid early saves during load)
          if (currentTimeMs >= 5000 && Math.abs(currentTimeMs - lastDbSyncPosition.current) > 5000) {
            syncProgressToDatabase(currentItem, currentTimeMs, durationMs);
            lastDbSyncPosition.current = currentTimeMs;
          }
        }
      }, DB_SYNC_INTERVAL_MS);
    } else {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
      if (saveProgressInterval.current) {
        clearInterval(saveProgressInterval.current);
      }
      if (dbSyncInterval.current) {
        clearInterval(dbSyncInterval.current);
      }
      // Only save on pause if we've made meaningful progress (at least 5 seconds)
      if (currentItem && position >= 5000) {
        saveProgress(currentItem, position, playbackSpeed);
        syncProgressToDatabase(currentItem, position, duration);
      }
    }

    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
      if (saveProgressInterval.current) {
        clearInterval(saveProgressInterval.current);
      }
      if (dbSyncInterval.current) {
        clearInterval(dbSyncInterval.current);
      }
    };
  }, [isPlaying, player, currentItem, playbackSpeed, position, duration, saveProgress, logEngagementEvent, syncProgressToDatabase]);

  // Autoplay next item when current playback finishes
  useEffect(() => {
    // Need valid duration and position, and must be playing
    if (!currentItem || !isPlaying || duration <= 0) return;
    
    // Guard against re-entry while processing
    if (isAutoplayProcessing.current) return;
    
    // Check if we've already triggered autoplay for this item
    const itemKey = `${currentItem.type}-${currentItem.id}`;
    if (autoplayTriggeredForItem.current === itemKey) return;
    
    // Check if playback is near the end (within 1 second of duration)
    const isNearEnd = position >= duration - 1000 && position > 0;
    
    if (isNearEnd) {
      console.log("[AudioPlayer] Playback finished, marking complete and playing next");
      
      // Set both guards immediately to prevent re-entry
      autoplayTriggeredForItem.current = itemKey;
      isAutoplayProcessing.current = true;
      
      // IMPORTANT: Pause audio immediately to stop position updates and prevent re-triggers
      player.pause();
      setPlaybackState("loading"); // Set to loading to indicate transition
      
      // Capture queue at this moment to avoid stale closures
      const currentQueue = [...queue];
      
      // Mark current item as complete in database
      const markCompleteAndPlayNext = async () => {
        try {
          if (currentItem.type === "summary" && currentItem.userBriefId) {
            await supabase
              .from("user_briefs")
              .update({ 
                is_completed: true,
                audio_progress_seconds: 0, // Reset to 0 so replay starts from beginning
                updated_at: new Date().toISOString(),
              })
              .eq("id", currentItem.userBriefId);
            queryClient.invalidateQueries({ queryKey: ["userBriefs"] });
          } else if (currentItem.type === "episode" && currentItem.savedEpisodeId) {
            await supabase
              .from("saved_episodes")
              .update({ 
                is_completed: true,
                audio_progress_seconds: 0, // Reset to 0 so replay starts from beginning
                updated_at: new Date().toISOString(),
              })
              .eq("id", currentItem.savedEpisodeId);
            queryClient.invalidateQueries({ queryKey: ["savedEpisodes"] });
            queryClient.invalidateQueries({ queryKey: ["savedEpisodes", "uuidsOnly"] });
          }
          
          // Play next item in queue if available
          if (currentQueue.length > 0) {
            const nextItem = currentQueue[0];
            // Update queue state - remove first item only
            setQueue(currentQueue.slice(1));
            // Delay to ensure state is settled before playing next
            setTimeout(() => {
              isAutoplayProcessing.current = false;
              if (playRef.current) {
                playRef.current(nextItem);
              }
            }, 300);
          } else {
            // No more items in queue - stop playback completely
            isAutoplayProcessing.current = false;
            setPlaybackState("idle");
            setCurrentItem(null);
          }
        } catch (error) {
          console.error("[AudioPlayer] Error in autoplay completion:", error);
          isAutoplayProcessing.current = false;
        }
      };
      
      markCompleteAndPlayNext();
    }
  // Note: play is intentionally not in deps to avoid recreation loop
  // The ref-based guard prevents multiple triggers
  }, [position, duration, isPlaying, currentItem, queue, queryClient]);

  const getSignedAudioUrl = async (masterBriefId: string): Promise<string> => {
    const { data, error } = await supabase.functions.invoke(
      "get-signed-audio-url",
      {
        body: { masterBriefId },
      }
    );
    if (error) throw error;
    return data.signedUrl;
  };

  const play = useCallback(
    async (item: AudioItem) => {
      try {
        setPlaybackState("loading");
        setCurrentItem(item);
        // Reset autoplay trigger for new item
        autoplayTriggeredForItem.current = null;

        // Set audio mode before each play to ensure silent mode works on iOS
        await setAudioModeAsync({
          playsInSilentMode: true,
          shouldPlayInBackground: true,
          interruptionMode: "doNotMix",
          interruptionModeAndroid: "doNotMix",
        });

        engagementSession.current = {
          sessionId: generateSessionId(),
          startLogged: false,
          completionLogged: false,
          accumulatedListeningMs: 0,
        };
        lastPositionForAccumulation.current = item.progress || 0;
        lastDbSyncPosition.current = item.progress || 0;
        lastSavedPosition.current = item.progress || 0;

        let audioUrl = item.audioUrl;

        if (item.type === "summary" && item.masterBriefId) {
          try {
            audioUrl = await getSignedAudioUrl(item.masterBriefId);
          } catch (e) {
            console.error("[AudioPlayer] Failed to get signed URL, using provided URL:", e);
          }
        }

        if (!audioUrl) {
          console.error("[AudioPlayer] No audio URL provided");
          setPlaybackState("error");
          return;
        }

        console.log("[AudioPlayer] Loading audio:", audioUrl.substring(0, 100));
        
        await player.replace({ uri: audioUrl });

        const savedProgress = await loadSavedProgress(item);
        let startPosition = item.progress || 0;
        
        if (savedProgress && savedProgress.currentTime > startPosition) {
          startPosition = savedProgress.currentTime;
          if (savedProgress.speed !== playbackSpeed) {
            setPlaybackSpeedState(savedProgress.speed);
            player.setPlaybackRate(savedProgress.speed);
          }
        }

        if (startPosition > 0) {
          player.seekTo(startPosition / 1000);
          lastPositionForAccumulation.current = startPosition;
        }

        player.setPlaybackRate(playbackSpeed);
        
        await player.play();
        setPlaybackState("playing");
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        if (Platform.OS !== "web" && typeof player.setActiveForLockScreen === "function") {
          setTimeout(() => {
            try {
              player.setActiveForLockScreen(true, {
                title: item.title,
                artist: item.podcast || "PodBrief",
                artworkUrl: item.artwork || undefined,
              });
              console.log("[AudioPlayer] Lock screen controls enabled");
            } catch (e) {
              console.log("[AudioPlayer] Lock screen controls not available (Expo Go limitation)");
            }
          }, 500);
        }
      } catch (error) {
        console.error("[AudioPlayer] Error playing audio:", error);
        setPlaybackState("error");
      }
    },
    [player, loadSavedProgress, playbackSpeed]
  );

  // Keep playRef updated for autoplay effect
  useEffect(() => {
    playRef.current = play;
  }, [play]);

  const pause = useCallback(() => {
    player.pause();
    setPlaybackState("paused");
    // Only save progress if we've made meaningful progress (at least 5 seconds)
    if (currentItem && position >= 5000) {
      saveProgress(currentItem, position, playbackSpeed);
    }
  }, [player, currentItem, position, playbackSpeed, saveProgress]);

  const resume = useCallback(async () => {
    // Set audio mode before resume to ensure silent mode works on iOS
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: "doNotMix",
      interruptionModeAndroid: "doNotMix",
    });
    player.play();
    setPlaybackState("playing");
  }, [player]);

  const stop = useCallback(() => {
    // Only save progress if we've made meaningful progress (at least 5 seconds)
    if (currentItem && position >= 5000) {
      saveProgress(currentItem, position, playbackSpeed);
    }
    player.pause();
    if (Platform.OS !== "web") {
      try {
        player.clearLockScreenControls();
      } catch (e) {
        console.error("[AudioPlayer] Error clearing lock screen controls:", e);
      }
    }
    setCurrentItem(null);
    setPlaybackState("idle");
  }, [player, currentItem, position, playbackSpeed, saveProgress]);

  const seekTo = useCallback(
    (positionMs: number) => {
      player.seekTo(positionMs / 1000);
    },
    [player]
  );

  const skipForward = useCallback(() => {
    const newPosition = Math.min(position + 15000, duration);
    seekTo(newPosition);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [position, duration, seekTo]);

  const skipBackward = useCallback(() => {
    const newPosition = Math.max(position - 15000, 0);
    seekTo(newPosition);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [position, seekTo]);

  const setSpeed = useCallback(
    async (speed: number) => {
      player.setPlaybackRate(speed);
      setPlaybackSpeedState(speed);
      try {
        await AsyncStorage.setItem(SPEED_KEY, speed.toString());
      } catch (error) {
        console.error("[AudioPlayer] Error saving speed:", error);
      }
      Haptics.selectionAsync();
    },
    [player]
  );

  const addToQueue = useCallback((item: AudioItem) => {
    setQueue((prev) => [...prev, item]);
  }, []);

  const removeFromQueue = useCallback((id: string) => {
    setQueue((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const clearQueue = useCallback(() => {
    setQueue([]);
  }, []);

  const playNext = useCallback(() => {
    if (queue.length > 0) {
      const nextItem = queue[0];
      setQueue((prev) => prev.slice(1));
      play(nextItem);
    }
  }, [queue, play]);

  const playWithQueue = useCallback(
    async (item: AudioItem, newQueue: AudioItem[]) => {
      setQueue(newQueue);
      await play(item);
    },
    [play]
  );

  return (
    <AudioPlayerContext.Provider
      value={{
        currentItem,
        playbackState,
        isPlaying,
        isLoading,
        position,
        duration,
        playbackSpeed,
        queue,
        isExpanded,
        play,
        playWithQueue,
        pause,
        resume,
        stop,
        seekTo,
        skipForward,
        skipBackward,
        setSpeed,
        addToQueue,
        removeFromQueue,
        clearQueue,
        playNext,
        setExpanded,
      }}
    >
      {children}
    </AudioPlayerContext.Provider>
  );
}

export function useAudioPlayerContext() {
  const context = useContext(AudioPlayerContext);
  if (context === undefined) {
    throw new Error(
      "useAudioPlayerContext must be used within an AudioPlayerProvider"
    );
  }
  return context;
}
