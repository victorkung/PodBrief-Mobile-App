# PodBrief

## Overview

PodBrief is an AI-powered cross-platform mobile application built with Expo/React Native, designed to help busy professionals efficiently consume podcast content. It offers full episode listening and AI-generated audio summaries. Users can search, follow, save episodes, generate AI briefs with text-to-speech, and manage offline downloads. The project aims to provide a streamlined podcast experience, emphasizing efficiency and content accessibility.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

- **Framework**: Expo SDK 54 with React Native 0.81 (new architecture).
- **Navigation**: React Navigation v7, featuring a root stack for auth/modals, a bottom tab navigator (Search, Shows, Library, Profile), and nested stack navigators. The Library screen includes inner tabs for Episodes and Summaries (Downloads removed - downloads are now an attribute, not a playlist).
- **State Management**: React Query for server state and caching; React Context for authentication and audio player state.
- **Styling**: Custom theme system with a premium editorial aesthetic, dark mode by default, and gold accent colors.
- **Animation**: React Native Reanimated for performant UI animations.
- **Audio**: `expo-audio` for podcast and summary playback, including background audio support and lock screen controls.
- **UI/UX Decisions**: Consistent screen layouts using safe area insets; specific button and input styling; two-column podcast detail headers; SegmentedControl without count badges; a 4-slide onboarding carousel. Library screen features Spotify-style item cards with integrated actions and optimistic updates for user interactions.

### Backend Architecture

- **Server**: Express.js with TypeScript, primarily serving as a host for Supabase Edge Functions.
- **Database**: PostgreSQL hosted on Supabase, managed with Drizzle ORM.
- **Authentication**: Supabase Auth with email/password.
- **API Pattern**: Business logic is primarily handled by Supabase Edge Functions (e.g., podcast search, brief generation, billing), complemented by REST API for direct database interactions.

### Data Storage Solutions

- **Primary Database**: Supabase PostgreSQL for profiles, briefs, followed podcasts, and saved episodes.
- **Local Storage**: AsyncStorage for session persistence, `expo-file-system` for offline audio, and `expo-secure-store` for sensitive data.

### Key Design Patterns

- **Path Aliases**: Standardized aliases (`@/`, `@shared/`).
- **Theming**: Centralized theme constants for consistent UI.
- **Component Structure**: Atomic design principles for reusable UI components.
- **Audio Progress Tracking**: Implemented `audio_engagement_events` to log listening duration and completion, syncing progress (audio_progress_seconds, is_completed) to the database and automatically marking content as complete at 75% playback.

## External Dependencies

- **Supabase**: Database, authentication, Edge Functions, storage.
- **Taddy API**: Podcast catalog search and metadata.
- **Google Gemini 3 Flash**: AI summarization and transcript condensation.
- **OpenAI TTS-1**: Text-to-speech for audio summaries.
- **Stripe**: Subscription billing and credit pack purchases.
- **Resend**: Transactional email delivery.
- **Loops.so**: Marketing automation.
- **PostHog**: Analytics.

## Database Schema (Breaking Changes - Feb 2026)

- **Dropped columns from `master_briefs`**: `pipeline_error`, `audio_status`, `transcript_content`, `ai_condensed_transcript`
- **Dropped columns from `user_briefs`**: `total_duration_minutes`
- **Retained on `master_briefs`**: `pipeline_status`, `total_duration_minutes`
- **New table `brief_pipeline_state`**: `master_brief_id` (FK), `pipeline_status`, `pipeline_error`, `summary_phase`, `audio_status`, `audio_error`
- **New table `brief_transcripts`**: `master_brief_id` (FK), `transcript_content`, `ai_condensed_transcript`
- **BriefDetailScreen**: Fetches full master_brief data including JOINed `brief_transcripts` and `brief_pipeline_state` via react-query on mount
- **LibraryScreen**: Query only selects columns still on `master_briefs`; no longer requests `transcript_content` or `ai_condensed_transcript`
- **TypeScript types**: `MasterBrief` has optional nested `brief_pipeline_state?: BriefPipelineState` and `brief_transcripts?: BriefTranscripts`
- **Edge function rename**: `generate-taddy-brief` renamed to `generate-brief` (same contract)
- **Retry logic**: `retry-taddy-transcript` now runs full pipeline in background (no separate summarization call needed). `regenerate-summary` has `resetToFailed` recovery path when transcript is missing. LibraryScreen handles both `failed` (calls `retry-taddy-transcript`) and `summary_failed` (calls `regenerate-summary`) with unified "Something went wrong" UI.
- **Error logging**: All `log-error` calls include `client_platform: 'mobile'`
- **Auto-retry**: LibraryScreen auto-retries stale briefs stuck in `pending`/`transcribing` for >2 minutes

## Recent Audio Player Improvements

- **iOS Silent Mode Fix**: `setAudioModeAsync` is now called before each `play()` and `resume()` action to ensure `playsInSilentMode: true` is always active
- **ExpandedPlayer UX**:
  - Skip labels (15s) display below icons with proper spacing
  - Added "Next" button (skip-forward icon) to play next item in queue
  - Progress bar seeking uses local state during drag for immediate visual feedback, with 500ms delay before resetting isSeeking to prevent visual jump-back
  - Removed "Remove" button from actions row
  - Unified swipe gesture: Removed ScrollView so entire player area responds to pan gesture for closing (no separate swipe zones)
- **EpisodeDetailScreen (Mobile-only UX)**:
  - Info-only view: Shows cover art, title, podcast name, date, duration, and description
  - No Play/Share/Mark Complete/Download buttons (different from web app)
  - CTA for generating brief if episode not yet summarized
- **Playlist Queue System**: 
  - `playWithQueue(item, queue)` function in AudioPlayerContext for playing with a queue
  - Library tabs (Episodes, Summaries, Downloads) auto-populate queue with remaining items when starting playback
  - Next button plays the next item in queue
- **Audio Switching UI Feedback**:
  - LibraryItemCard shows loading indicator on play button when that specific item is loading
  - `isPlaying` checks now include `isLoading` state so items show as active during loading
- **Mark Complete Fix**: 
  - EpisodeDetailScreen now passes `savedEpisodeId` when playing saved episodes, enabling Mark Complete functionality
  - BriefDetailScreen already correctly passes `masterBriefId` and `userBriefId`
- **Autoplay Next Item** (improved from Lovable audit):
  - Uses expo-audio's `didJustFinish` status for reliable end detection (fires exactly once when track ends, more reliable than position-based checking)
  - Next track is captured BEFORE any async operations to prevent stale queue references
  - Current item is marked as complete in database, React Query cache invalidated
  - Uses `pendingAutoAdvanceRef` to store pending autoplay for AppState recovery
  - AppState listener resumes pending autoplay when app becomes active (if <10 minutes old)
  - Uses multiple ref-based guards (`didJustFinishHandled`, `autoplayTriggeredForItem`, `isAutoplayProcessing`) to prevent duplicate triggers
  - `setAudioModeAsync` called on mount AND before each play for redundancy
- **Previous Track / History Tracking**:
  - `playPrevious()` function: Restarts current track if >3 seconds played, otherwise jumps to previous track in history
  - `history` state maintains last 50 played items for navigation
  - History is updated when advancing to next track (manually or via autoplay)
  - ExpandedPlayer has skip-back button (grays out when no history and <3s into track)
- **Remote Command Listeners** (Headphone/Lock Screen Controls):
  - Registered for play, pause, toggle, next track, and previous track commands
  - Uses expo-audio player.addListener with 'as any' type assertion (API not fully typed yet)
  - Will function in production builds (TestFlight/App Store), may not work in Expo Go
  - Gracefully falls back if events not supported on current platform

## Offline Mode

- **Network Detection**: Uses `@react-native-community/netinfo` via `NetworkContext` to track connectivity status
- **Library Filters**: Three filter options - Unfinished (default), Completed, and Downloaded
- **Offline Behavior**:
  - Non-downloaded items appear muted/disabled (50% opacity) when offline
  - Play button shows wifi-off icon for unavailable items
  - Playback queue only includes downloaded items when offline
  - Downloaded items remain fully functional regardless of network status
- **Downloads as Attributes**: Downloads are now treated as an attribute of episodes/summaries (Spotify model) rather than a separate playlist tab
- **Download Progress UI**:
  - Uses `CircularProgress` component (react-native-svg) to show download progress ring during download
  - Download icon shows Spotify-style circular progress ring with gold/yellow color during download
  - Completed downloads show yellow/gold check-circle icon
  - Uses `FileSystem.createDownloadResumable` with progress callback for real-time progress tracking
  - Progress state stored per item ID in Map for independent tracking
  - Web platform shows alert that downloads are only available in mobile app (expo-file-system native-only feature)

## Push Notifications

- **Infrastructure**: Uses `expo-notifications` and `expo-device` for push notification handling
- **Token Registration**: NotificationContext automatically registers for push tokens when authenticated user is present
- **Token Storage**: Push tokens stored in Supabase `profiles.expo_push_token` column
- **Notification Handler**: Configured to show alerts, play sounds, and show in notification center
- **Deep Linking**: Notification taps navigate to specific summary via `masterBriefId` in notification data
- **Server Endpoints**:
  - `POST /api/send-notification`: Send single push notification (expoPushToken, title, body, data)
  - `POST /api/send-notifications-batch`: Send batch notifications to multiple users
- **Supabase Integration**: Edge Function should call the send-notification endpoint when pipeline completes/fails
- **Web Compatibility**: Gracefully handles web platform where push notifications are not available
- **Generation Time**: Summary generation takes 2-3 minutes; users receive push notification and email when complete