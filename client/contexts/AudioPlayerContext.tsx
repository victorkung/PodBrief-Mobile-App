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
import * as Haptics from "expo-haptics";
import { supabase } from "@/lib/supabase";
import { AudioItem } from "@/lib/types";

interface AudioPlayerContextType {
  currentItem: AudioItem | null;
  isPlaying: boolean;
  isLoading: boolean;
  position: number;
  duration: number;
  playbackSpeed: number;
  queue: AudioItem[];
  play: (item: AudioItem) => Promise<void>;
  pause: () => void;
  resume: () => void;
  seekTo: (position: number) => void;
  skipForward: () => void;
  skipBackward: () => void;
  setSpeed: (speed: number) => void;
  addToQueue: (item: AudioItem) => void;
  removeFromQueue: (id: string) => void;
  clearQueue: () => void;
  playNext: () => void;
}

const AudioPlayerContext = createContext<AudioPlayerContextType | undefined>(
  undefined
);

const SPEED_OPTIONS = [0.5, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2];

export function AudioPlayerProvider({ children }: { children: ReactNode }) {
  const player = useAudioPlayer("");
  const [currentItem, setCurrentItem] = useState<AudioItem | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [queue, setQueue] = useState<AudioItem[]>([]);
  const progressInterval = useRef<NodeJS.Timeout | null>(null);

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
    } else {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
    }

    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
    };
  }, [isPlaying, player]);

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
        setIsLoading(true);
        setCurrentItem(item);

        let audioUrl = item.audioUrl;

        if (item.type === "summary" && item.masterBriefId) {
          audioUrl = await getSignedAudioUrl(item.masterBriefId);
        }

        await player.replace({ uri: audioUrl });
        
        if (item.progress > 0) {
          player.seekTo(item.progress / 1000);
        }
        
        player.play();
        setIsPlaying(true);
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch (error) {
        console.error("Error playing audio:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [player]
  );

  const pause = useCallback(() => {
    player.pause();
    setIsPlaying(false);
  }, [player]);

  const resume = useCallback(() => {
    player.play();
    setIsPlaying(true);
  }, [player]);

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
    (speed: number) => {
      player.setPlaybackRate(speed);
      setPlaybackSpeed(speed);
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
        isPlaying,
        isLoading,
        position,
        duration,
        playbackSpeed,
        queue,
        play,
        pause,
        resume,
        seekTo,
        skipForward,
        skipBackward,
        setSpeed,
        addToQueue,
        removeFromQueue,
        clearQueue,
        playNext,
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
