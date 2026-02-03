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
import { Platform, AppState, AppStateStatus } from "react-native";

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

interface PendingAutoAdvance {
  track: AudioItem;
  timestamp: number;
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
  const pendingAutoAdvanceRef = useRef<PendingAutoAdvance | null>(null);
  const completionTriggered = useRef(false);
  const lastPositionForStallDetection = useRef(0);
  const stallCount = useRef(0);
  const trackLoadedAt = useRef<number>(0); // Timestamp when track started loading

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
      // Note: We no longer auto-set is_completed here
      // Users must manually mark episodes/summaries as complete

      if (item.type === "summary" && item.userBriefId) {
        await supabase
          .from("user_briefs")
          .update({ 
            audio_progress_seconds: progressSeconds,
            updated_at: new Date().toISOString(),
          })
          .eq("id", item.userBriefId);
      } else if (item.type === "episode" && item.savedEpisodeId) {
        await supabase
          .from("saved_episodes")
          .update({ 
            audio_progress_seconds: progressSeconds,
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

  // Handle autoplay when track finishes using didJustFinish (more reliable than position-based)
  const handleTrackEnded = useCallback(async () => {
    if (!currentItem) return;
    
    // Guard against multiple triggers
    if (isAutoplayProcessing.current) return;
    isAutoplayProcessing.current = true;
    
    console.log("[AudioPlayer] Track ended. Queue length:", queue.length);
    
    // IMMEDIATELY capture next track BEFORE any async operations (key fix from Lovable audit)
    const nextItem = queue.length > 0 ? queue[0] : null;
    const remainingQueue = queue.slice(1);
    
    // Set playback state to loading during transition
    setPlaybackState("loading");
    
    try {
      // Clear AsyncStorage progress so replay starts from beginning
      const progressKey = getProgressKey(currentItem);
      await AsyncStorage.removeItem(progressKey);
      console.log("[AudioPlayer] Cleared AsyncStorage progress for:", progressKey);
      
      // Note: We no longer auto-mark items as complete here
      // User must manually mark episodes/summaries as complete
      
      // Play next item using captured reference
      if (nextItem) {
        console.log("[AudioPlayer] Playing next item:", nextItem.title);
        // Update queue state
        setQueue(remainingQueue);
        
        // Store pending autoplay in case app is backgrounded
        pendingAutoAdvanceRef.current = {
          track: nextItem,
          timestamp: Date.now(),
        };
        
        // Small delay to ensure state is settled, then play next
        // IMPORTANT: Keep isAutoplayProcessing = true until AFTER play completes
        setTimeout(async () => {
          pendingAutoAdvanceRef.current = null;
          if (playRef.current) {
            await playRef.current(nextItem);
          }
          // Only reset after play has started (play resets guards in its own logic)
          isAutoplayProcessing.current = false;
        }, 300);
      } else {
        // No more items in queue - mark as paused but keep currentItem so user can replay
        console.log("[AudioPlayer] No more items in queue, episode finished - keeping item for replay");
        isAutoplayProcessing.current = false;
        setPlaybackState("paused");
        // Don't clear currentItem - user can still tap play to replay the episode
      }
    } catch (error) {
      console.error("[AudioPlayer] Error in autoplay completion:", error);
      isAutoplayProcessing.current = false;
      setPlaybackState("idle");
    }
  }, [currentItem, queue, getProgressKey]);

  // Reset completion tracking when currentItem changes
  useEffect(() => {
    completionTriggered.current = false;
    stallCount.current = 0;
    lastPositionForStallDetection.current = 0;
  }, [currentItem?.id]);

  // Position-based completion detection using METADATA duration (100% reliable)
  // This replaces didJustFinish which fires unreliably with streaming audio
  useEffect(() => {
    if (!currentItem) return;
    
    // Use metadata duration (from episode_duration_seconds) as source of truth
    const metadataDuration = currentItem.duration;
    if (!metadataDuration || metadataDuration <= 0) return;
    
    // Guard: If position exceeds duration by more than 5 seconds, it's stale data from previous track
    // This prevents false triggering when auto-advancing between tracks of different lengths
    if (position > metadataDuration + 5000) {
      return;
    }
    
    // Guard: Don't trigger completion within first 3 seconds of loading a new track
    // This prevents immediate re-triggering when replaying a finished episode
    const timeSinceLoad = Date.now() - trackLoadedAt.current;
    if (timeSinceLoad < 3000) {
      return;
    }
    
    // Check if we've reached within 2 seconds of the end
    const timeRemaining = metadataDuration - position;
    const isNearEnd = timeRemaining <= 2000 && position > 0;
    
    // Use expo-audio's ACTUAL playing status (not our internal state)
    // This correctly detects when audio stops at track end
    const actuallyPlaying = playerStatus.playing;
    const playbackStopped = !actuallyPlaying && playbackState !== "loading";
    
    // Trigger completion when: near end AND (playback stopped OR position stalled)
    if (isNearEnd && !completionTriggered.current) {
      // Check for stall (position not advancing)
      if (position === lastPositionForStallDetection.current) {
        stallCount.current += 1;
      } else {
        stallCount.current = 0;
      }
      lastPositionForStallDetection.current = position;
      
      // Complete if playback stopped OR stalled for 3+ updates (~1.5 seconds)
      if (playbackStopped || stallCount.current >= 3) {
        const itemKey = `${currentItem.type}-${currentItem.id}`;
        if (autoplayTriggeredForItem.current !== itemKey) {
          console.log("[AudioPlayer] Track completed (position-based detection)", {
            position: Math.round(position / 1000),
            metadataDuration: Math.round(metadataDuration / 1000),
            timeRemaining: Math.round(timeRemaining / 1000),
            playbackStopped,
            actuallyPlaying,
            stallCount: stallCount.current,
          });
          
          completionTriggered.current = true;
          autoplayTriggeredForItem.current = itemKey;
          handleTrackEnded();
        }
      }
    }
  }, [position, playerStatus.playing, playbackState, currentItem, handleTrackEnded]);

  // Stall detection as backup - catches streams that stop before reaching metadata duration
  // Uses metadata duration for accurate progress calculation
  useEffect(() => {
    if (!isPlaying || !currentItem) {
      return;
    }

    // Use metadata duration for progress calculation
    const metadataDuration = currentItem.duration;
    if (!metadataDuration || metadataDuration <= 0) return;

    // Guard: If position exceeds duration by more than 5 seconds, it's stale data from previous track
    if (position > metadataDuration + 5000) {
      return;
    }
    
    // Guard: Don't trigger completion within first 3 seconds of loading a new track
    const timeSinceLoad = Date.now() - trackLoadedAt.current;
    if (timeSinceLoad < 3000) {
      return;
    }

    const progressRatio = position / metadataDuration;

    // Only check for stalls when we're past 85% of the episode
    if (progressRatio < 0.85) {
      return;
    }

    // If position hasn't changed for 4+ consecutive checks (~2 seconds), treat as stream ended
    if (position > 0 && position === lastPositionForStallDetection.current) {
      stallCount.current += 1;
      
      if (stallCount.current >= 4 && !completionTriggered.current) {
        console.log("[AudioPlayer] Stall detected near end - treating as completed", {
          position: Math.round(position / 1000),
          metadataDuration: Math.round(metadataDuration / 1000),
          progressRatio: (progressRatio * 100).toFixed(1) + "%",
          stallCount: stallCount.current,
        });
        
        completionTriggered.current = true;
        const itemKey = `${currentItem.type}-${currentItem.id}`;
        if (autoplayTriggeredForItem.current !== itemKey) {
          autoplayTriggeredForItem.current = itemKey;
          handleTrackEnded();
        }
      }
    } else {
      stallCount.current = 0;
      lastPositionForStallDetection.current = position;
    }
  }, [position, isPlaying, currentItem, handleTrackEnded]);

  // AppState listener for background recovery
  // When app comes back from background, check if we had a pending autoplay
  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'active' && pendingAutoAdvanceRef.current) {
        const pending = pendingAutoAdvanceRef.current;
        const ageMinutes = (Date.now() - pending.timestamp) / 60000;
        
        // Only resume if less than 10 minutes old
        if (ageMinutes < 10) {
          console.log("[AudioPlayer] Resuming pending autoplay after app became active");
          pendingAutoAdvanceRef.current = null;
          isAutoplayProcessing.current = false;
          if (playRef.current) {
            playRef.current(pending.track);
          }
        } else {
          console.log("[AudioPlayer] Pending autoplay expired (>10 minutes)");
          pendingAutoAdvanceRef.current = null;
          isAutoplayProcessing.current = false;
        }
      }
    };
    
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, []);

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
        // IMPORTANT: Save current item's progress BEFORE switching to new item
        // This ensures backward seeks (like seeking to beginning) are preserved
        // BUT: Don't re-save if the item just finished (position at/near end) - we already cleared it
        if (currentItem && currentItem.id !== item.id) {
          const itemDuration = currentItem.duration || 0;
          const isNearEnd = itemDuration > 0 && (itemDuration - position) <= 5000;
          if (isNearEnd) {
            console.log("[AudioPlayer] Skipping progress save - item just finished");
          } else {
            await saveProgress(currentItem, position, playbackSpeed);
            console.log("[AudioPlayer] Saved previous item progress before switching:", Math.round(position / 1000), "seconds");
          }
        }
        
        setPlaybackState("loading");
        setCurrentItem(item);
        // Reset autoplay guards for new item
        autoplayTriggeredForItem.current = null;
        completionTriggered.current = false;
        trackLoadedAt.current = Date.now(); // Track when this item started loading

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

        // AsyncStorage is source of truth for local device - use it if available
        // Database progress is fallback for cross-device sync
        const savedProgress = await loadSavedProgress(item);
        let startPosition = 0;
        
        if (savedProgress && savedProgress.currentTime > 0) {
          // Use AsyncStorage progress directly (local source of truth)
          // BUT: If progress is very near the end (within 5 seconds), treat as finished and start from 0
          const episodeDuration = item.duration || 0;
          const isNearEnd = episodeDuration > 0 && (episodeDuration - savedProgress.currentTime) <= 5000;
          if (isNearEnd) {
            console.log("[AudioPlayer] AsyncStorage progress near end, starting from beginning");
            startPosition = 0;
          } else {
            startPosition = savedProgress.currentTime;
            console.log("[AudioPlayer] Using AsyncStorage progress:", Math.round(startPosition / 1000), "seconds");
            if (savedProgress.speed !== playbackSpeed) {
              setPlaybackSpeedState(savedProgress.speed);
              player.setPlaybackRate(savedProgress.speed);
            }
          }
        } else if (item.progress && item.progress > 0) {
          // Fallback to database progress for cross-device sync
          // BUT: If progress is very near the end (within 5 seconds), treat as finished and start from 0
          const episodeDuration = item.duration || 0;
          const isNearEnd = episodeDuration > 0 && (episodeDuration - item.progress) <= 5000;
          if (isNearEnd) {
            console.log("[AudioPlayer] Database progress near end, starting from beginning");
            startPosition = 0;
          } else {
            startPosition = item.progress;
            console.log("[AudioPlayer] Using database progress:", Math.round(startPosition / 1000), "seconds");
          }
        }

        if (startPosition > 0) {
          player.seekTo(startPosition / 1000);
          lastPositionForAccumulation.current = startPosition;
        }
        
        // Initialize lastSavedPosition to current start position
        lastSavedPosition.current = startPosition;

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
    [player, loadSavedProgress, playbackSpeed, currentItem, position, saveProgress]
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
      // Save progress immediately on seek so backward seeks are captured
      if (currentItem) {
        saveProgress(currentItem, positionMs, playbackSpeed);
        lastSavedPosition.current = positionMs;
      }
    },
    [player, currentItem, playbackSpeed, saveProgress]
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
