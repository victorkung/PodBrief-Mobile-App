# PodBrief

## Overview

PodBrief is an AI-powered podcast player and summarizer built as a cross-platform mobile application using Expo/React Native. The app helps busy professionals consume podcast content efficiently through two modes: full episode listening or AI-generated audio summaries. Users can search podcasts, follow shows, save episodes, generate AI briefs (summaries with TTS audio), and manage offline downloads.

The application follows a client-server architecture with an Express backend serving a React Native/Expo frontend. The backend connects to a Supabase-hosted PostgreSQL database with approximately 40 Edge Functions handling podcast discovery, brief generation, and user management.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

- **Framework**: Expo SDK 54 with React Native 0.81, using the new architecture
- **Navigation**: React Navigation v7 with a hybrid structure:
  - Root stack navigator for auth flow and modals
  - Bottom tab navigator with 4 tabs (Search, Shows, Library, Profile)
  - Library screen has 3 inner tabs via SegmentedControl (Episodes, Summaries, Downloads)
  - Nested stack navigators for each tab
- **State Management**: 
  - React Query for server state and caching
  - React Context for auth state (`AuthContext`) and audio player state (`AudioPlayerContext`)
- **Styling**: Custom theme system with dark mode as default, using a premium editorial aesthetic with gold accent colors
- **Animation**: React Native Reanimated for performant animations
- **Audio**: expo-audio for podcast and summary playback with background audio support

### Backend Architecture

- **Server**: Express.js with TypeScript, minimal local routes as most logic lives in Supabase Edge Functions
- **Database**: PostgreSQL via Supabase with Drizzle ORM for schema management
- **Authentication**: Supabase Auth with email/password (Google SSO deferred for mobile - requires Supabase multi-client-ID configuration)
- **API Pattern**: Edge Functions for business logic (podcast search, brief generation, billing), REST API for direct database access

### Data Storage Solutions

- **Primary Database**: PostgreSQL (Supabase) with tables for profiles, master_briefs, user_briefs, followed_podcasts, saved_episodes
- **Local Storage**: 
  - AsyncStorage for auth session persistence
  - expo-file-system for offline audio downloads
  - expo-secure-store for sensitive data

### Key Design Patterns

- **Path Aliases**: `@/` maps to `./client`, `@shared/` maps to `./shared`
- **Theming**: Centralized theme constants with Colors, Spacing, BorderRadius, Typography, and GradientColors
- **Component Structure**: Atomic design with reusable components (ThemedText, ThemedView, Card, Button, etc.)
- **Screen Layout**: Consistent pattern using safe area insets, header height, and tab bar height for proper content positioning
- **Button Styling**: Grey/semi-transparent backgrounds (theme.backgroundTertiary) for most buttons; gold (theme.gold) for primary emphasis actions like Follow when not following
- **Search Input Styling**: Smaller font sizes (14px input, 18px icon, caption text for Search button)
- **Episode Cards**: Action buttons (Add Episode, Summarize) stack below content row for better mobile UX
- **Podcast Detail Layout**: Two-column header with 100px artwork left, title/creator/episode count/Follow button on right
- **Segmented Control**: No count badges on tabs (cleaner appearance)
- **Onboarding Flow**: 4-slide carousel for first-time users showcasing value proposition:
  - Slide 1: Welcome with logo, headline, and free briefs messaging
  - Slide 2: Free Podcast Player features
  - Slide 3: AI Summaries with ROI stats (17.5 hours saved, $506 value, 28x return)
  - Slide 4: Offline Downloads features
  - Navigation: "Start Listening Free" → signup, "Log In" → signin
  - Status stored in AsyncStorage (`@podbrief_onboarding_complete`)

## External Dependencies

### Third-Party Services

| Service | Purpose |
|---------|---------|
| **Supabase** | Database, authentication, Edge Functions, storage |
| **Taddy API** | Podcast catalog search and metadata |
| **Google Gemini 3 Flash** | AI summarization and transcript condensation |
| **OpenAI TTS-1** | Text-to-speech for audio summaries |
| **Stripe** | Subscription billing and credit pack purchases |
| **Resend** | Transactional email delivery |
| **Loops.so** | Marketing automation |
| **PostHog** | Analytics |

### Supabase Configuration

- **Project URL**: `https://wdylkaiyoelfcmphoaqs.supabase.co`
- **Edge Functions Base**: `https://wdylkaiyoelfcmphoaqs.supabase.co/functions/v1/`
- **Key Edge Functions**: `taddy-search`, `taddy-podcast-details`, `create-checkout`, `customer-portal`, `ensure-episode-metadata`, `ensure-podcast-metadata`, `sync-to-loops`, `generate-taddy-brief`, `log-error`

### Known Issues

- **CORS Configuration**: Supabase Edge Functions are configured to only accept requests from `https://podbrief.io`. Development domains are blocked - CORS has been updated to allow `exp://*` and `*.expo.dev` for mobile development
- **Google SSO (Deferred)**: Mobile Google Sign-In requires Supabase to accept multiple Client IDs for iOS/Android apps
- **Taddy API Limits**: `limitPerPage` must be between 1-25 (not 30)

### Recent Changes (Feb 2026)

- **React Query Cache Key Fix**:
  - Fixed critical bug where Library Episodes tab didn't display episode metadata (title, podcast name, date) on initial render
  - Root cause: Multiple screens used the same queryKey `["savedEpisodes"]` but with different `select()` fields - screens needing only UUIDs corrupted the cache for screens needing full episode data
  - Solution: Screens that only need `taddy_episode_uuid` now use queryKey `["savedEpisodes", "uuidsOnly"]` while LibraryScreen continues using `["savedEpisodes"]` for full data
  - All mutations invalidate both query keys to keep caches in sync

- **UI Polish**:
  - Toast font: Removed fontWeight from toastText style to use GoogleSansFlex_400Regular properly
  - Back button: Set `headerBackButtonDisplayMode: "minimal"` for smaller arrow-only back button
  - Episode description: Reduced lineHeight from 22 to 18 for tighter text
  - Summary banner: Updated text to "Generate an AI-powered summary for this episode that you can read or listen to in ~5 min instead of spending X min on the full episode"
  - Summarize button: Changed to use `type="caption"` and `paddingHorizontal: Spacing.md` to match action buttons
  - Episode action buttons: Reduced icon size from 18 to 16, changed text type from "small" to "caption", reduced padding from md/lg to sm/md

- **Episode Description Fetching**:
  - EpisodeDetailScreen fetches description via `get-episode-details` Edge Function when viewing SavedEpisodes from Library
  - Fail silently if `episode_metadata` doesn't exist yet (no error modal)
  - Database schema: `saved_episodes` table does NOT have `episode_description` column - descriptions stored in `episode_metadata` table instead

- **Edge Function Integrations (Matching Web App)**:
  - All Edge Function calls use fire-and-forget pattern with `.catch()` so failures don't block main user flow
  
  - **ensure-episode-metadata**: Creates SEO-friendly public URLs for episode sharing
    - Called in: `EpisodeDetailScreen.tsx` - `saveMutation.onSuccess`, `handleDownload`
    - Deduplication: Checks by `taddy_episode_uuid` before inserting
    - Body: `{ taddyEpisodeUuid, taddyPodcastUuid, name, podcastName, imageUrl, audioUrl, durationSeconds, publishedAt }`
  
  - **ensure-podcast-metadata**: Creates SEO-friendly public URLs for show pages
    - Called in: `PodcastDetailScreen.tsx` - `followMutation.onSuccess`
    - Deduplication: Checks by `taddy_podcast_uuid` before inserting
    - Body: `{ taddyPodcastUuid, name, description, imageUrl, authorName, totalEpisodesCount }`
  
  - **sync-to-loops**: Marketing automation sync for engagement metrics
    - Called in: `AuthContext.tsx` - after signup with action='signup'
    - Called in: `PodcastDetailScreen.tsx` - after follow/unfollow with action='engagement_update' and showsFollowed count
    - Called in: `GenerateBriefScreen.tsx` - after brief generation with action='engagement_update' and briefsGenerated count
    - Body: `{ action, email, userId, showsFollowed?, briefsGenerated?, lastBriefDate? }`
  
  - **log-error**: Client-side error logging for debugging
    - Called in: `ErrorBoundary` via `createErrorHandler()` utility in `client/lib/errorLogger.ts`
    - Body: `{ error_message, error_source, url, error_code?, metadata? }`

- **Global Toast Notification System**:
  - Added ToastContext and ToastProvider for app-wide toast messages
  - Toast types: success (gold), error (red), info (gray)
  - Auto-dismisses after 2.5 seconds with smooth animations
  - Shows feedback for mark complete/unfinished actions

- **Library Screen Redesign**:
  - Moved Downloads from bottom nav into Library as third tab (Episodes, Summaries, Downloads)
  - Bottom nav now has 4 tabs: Search, Shows, Library, Profile
  - New Spotify-style LibraryItemCard with content on top, action buttons below
  - Action buttons: Mark Complete (checkmark), Download (arrow), Share, Three-dots menu, Play
  - Three-dots menu: Remove from Library, Summarize (episodes only) - white text
  - Mark Complete removed from menu (only available as icon)
  - Auto-adds episodes to Library when downloading
  - Download/remove download functionality from Library cards
  - useFocusEffect for data refetching when screen is focused
  - Optimistic updates for mark complete actions (instant UI feedback)

- **LibraryItemCard UI Updates**:
  - Converted from card layout to compact row layout (like Shows/Search pages)
  - Removed action buttons row - actions now in three-dots menu only
  - Artwork: 56x56 with completed badge indicator
  - Title: white text with bold weight
  - Podcast name: grey (textSecondary) 
  - Date/Duration: lighter grey (textTertiary)
  - Three-dots menu includes: Mark Complete, Download, Share, Summarize, Remove

- **Library Search & Filter**:
  - Added search bar to filter episodes/summaries by title or podcast name
  - Added compact filter dropdown: Unfinished (default), Completed, All
  - Filter not shown on Downloads tab
  - Empty states update based on current filter

- **Shows Screen**: Fixed alphabetical sorting on initial load using `useMemo` to ensure podcasts are always sorted by name
- **MiniPlayer**: Fixed `useBottomTabBarHeight` error by using `BottomTabBarHeightContext` with fallback to safe area insets for stack screens
- **Episode Detail Actions**:
  - **Play**: Uses direct audio URL from episode data, wrapped with error handling
  - **Share**: Uses React Native's Share API to share episode URL with deep link
  - **Add/Remove**: Toggles saved_episodes with haptic feedback (success for add, medium for remove)
  - **Download**: Full implementation using new expo-file-system API (`Paths`, `File`, `Directory` classes), saves to AsyncStorage for Downloads screen
- **expo-file-system**: Updated to use new class-based API (`Paths.document`, `Directory`, `File`) instead of legacy `documentDirectory`

- **Audio Analytics & Progress Tracking (Feb 2 Audit Fixes)**:
  - Added `audio_engagement_events` tracking to `AudioPlayerContext`:
    - Logs `start` event after 30 seconds of accumulated listening time
    - Logs `completion` event when playback reaches 75%
    - Each playback session gets a unique `session_id`
  - Added database sync for progress (throttled every 15 seconds):
    - `user_briefs.audio_progress_seconds` and `user_briefs.is_completed`
    - `saved_episodes.audio_progress_seconds` and `saved_episodes.is_completed`
  - Auto-complete: Marks episodes/briefs as complete when playback reaches 75%
  - Library briefs query now filters by `profile.preferred_language`
  - Summary downloads use `get-signed-audio-url` Edge Function instead of direct URLs

### Key NPM Packages

- `@supabase/supabase-js` - Supabase client
- `@tanstack/react-query` - Data fetching and caching
- `expo-audio` - Audio playback
- `expo-file-system` - File management for downloads
- `drizzle-orm` / `drizzle-zod` - Database ORM and validation
- `react-native-reanimated` - Animations
- `expo-blur` / `expo-linear-gradient` - Visual effects