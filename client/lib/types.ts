export interface Profile {
  id: string;
  email: string;
  first_name: string | null;
  credits: number;
  plan: "free" | "pro";
  preferred_language: string;
  pro_expires_at: string | null;
  subscription_cancel_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MasterBrief {
  id: string;
  taddy_episode_uuid: string | null;
  taddy_podcast_uuid: string | null;
  language: string;
  podcast_name: string | null;
  episode_name: string | null;
  episode_thumbnail: string | null;
  episode_audio_url: string | null;
  episode_duration_seconds: number | null;
  episode_published_at: string | null;
  slug: string | null;
  transcript_content: string | null;
  ai_condensed_transcript: string | null;
  summary_text: string | null;
  audio_url: string | null;
  audio_status: string | null;
  audio_duration_seconds: number | null;
  pipeline_status: string | null;
  pipeline_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserBrief {
  id: string;
  user_id: string;
  master_brief_id: string;
  slug: string;
  is_completed: boolean;
  audio_progress_seconds: number;
  is_hidden: boolean;
  is_gifted: boolean;
  preferred_language: string;
  total_duration_minutes: number | null;
  created_at: string;
  updated_at: string;
  master_brief?: MasterBrief;
}

export interface SavedEpisode {
  id: string;
  user_id: string;
  taddy_episode_uuid: string;
  taddy_podcast_uuid: string;
  episode_name: string;
  podcast_name: string;
  episode_thumbnail: string | null;
  episode_audio_url: string | null;
  episode_duration_seconds: number | null;
  episode_published_at: string | null;
  is_completed: boolean;
  audio_progress_seconds: number;
  created_at: string;
  updated_at: string;
}

export interface FollowedPodcast {
  id: string;
  user_id: string;
  taddy_podcast_uuid: string;
  podcast_name: string;
  podcast_description: string | null;
  podcast_image_url: string | null;
  author_name: string | null;
  total_episodes_count: number | null;
  created_at: string;
  updated_at: string;
}

export interface TaddyPodcast {
  uuid: string;
  name: string;
  imageUrl: string | null;
  authorName: string | null;
  description: string | null;
  totalEpisodesCount: number;
}

export interface TaddyEpisode {
  uuid: string;
  name: string;
  imageUrl: string | null;
  description: string | null;
  datePublished: number;
  duration: number;
  audioUrl: string;
  taddyTranscribeStatus: string;
  podcastSeries?: {
    uuid: string;
    name: string;
    imageUrl: string | null;
  };
}

export interface AudioItem {
  id: string;
  type: "summary" | "episode";
  title: string;
  podcast: string;
  artwork: string | null;
  audioUrl: string;
  duration: number;
  progress: number;
  masterBriefId?: string;
  userBriefId?: string;
  savedEpisodeId?: string;
}

export type TabType = "episodes" | "summaries";
export type ShowsTabType = "shows" | "newEpisodes";
