import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  ReactNode,
  useCallback,
} from "react";
import { useAudioPlayer, AudioPlayer } from "expo-audio";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { supabase } from "@/lib/supabase";
import { AudioItem } from "@/lib/types";

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

export function AudioPlayerProvider({ children }: { children: ReactNode }) {
  const player = useAudioPlayer("");
  const [currentItem, setCurrentItem] = useState<AudioItem | null>(null);
  const [playbackState, setPlaybackState] = useState<PlaybackState>("idle");
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeedState] = useState(1);
  const [queue, setQueue] = useState<AudioItem[]>([]);
  const [isExpanded, setExpanded] = useState(false);
  const progressInterval = useRef<NodeJS.Timeout | null>(null);
  const saveProgressInterval = useRef<NodeJS.Timeout | null>(null);
  const lastSavedPosition = useRef(0);

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
    if (isPlaying) {
      progressInterval.current = setInterval(() => {
        if (player.currentTime !== undefined) {
          setPosition(player.currentTime * 1000);
        }
        if (player.duration !== undefined) {
          setDuration(player.duration * 1000);
        }
      }, 500);

      saveProgressInterval.current = setInterval(() => {
        if (currentItem && player.currentTime !== undefined) {
          const currentTimeMs = player.currentTime * 1000;
          if (Math.abs(currentTimeMs - lastSavedPosition.current) > 5000) {
            saveProgress(currentItem, currentTimeMs, playbackSpeed);
          }
        }
      }, 10000);
    } else {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
      if (saveProgressInterval.current) {
        clearInterval(saveProgressInterval.current);
      }
      if (currentItem && position > 0) {
        saveProgress(currentItem, position, playbackSpeed);
      }
    }

    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
      if (saveProgressInterval.current) {
        clearInterval(saveProgressInterval.current);
      }
    };
  }, [isPlaying, player, currentItem, playbackSpeed, position, saveProgress]);

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
          setPosition(startPosition);
        }

        player.setPlaybackRate(playbackSpeed);
        
        await player.play();
        setPlaybackState("playing");
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch (error) {
        console.error("[AudioPlayer] Error playing audio:", error);
        setPlaybackState("error");
      }
    },
    [player, loadSavedProgress, playbackSpeed]
  );

  const pause = useCallback(() => {
    player.pause();
    setPlaybackState("paused");
    if (currentItem) {
      saveProgress(currentItem, position, playbackSpeed);
    }
  }, [player, currentItem, position, playbackSpeed, saveProgress]);

  const resume = useCallback(() => {
    player.play();
    setPlaybackState("playing");
  }, [player]);

  const stop = useCallback(() => {
    if (currentItem) {
      saveProgress(currentItem, position, playbackSpeed);
    }
    player.pause();
    setCurrentItem(null);
    setPlaybackState("idle");
    setPosition(0);
    setDuration(0);
  }, [player, currentItem, position, playbackSpeed, saveProgress]);

  const seekTo = useCallback(
    (positionMs: number) => {
      player.seekTo(positionMs / 1000);
      setPosition(positionMs);
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
