# PodBrief

## Overview

PodBrief is an AI-powered cross-platform mobile application built with Expo/React Native, designed to help busy professionals efficiently consume podcast content. It offers full episode listening and AI-generated audio summaries. Users can search, follow, save episodes, generate AI briefs with text-to-speech, and manage offline downloads. The project aims to provide a streamlined podcast experience, emphasizing efficiency and content accessibility through AI-powered content summarization and seamless audio playback.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend

- **Framework**: Expo SDK 54 with React Native 0.81 (new architecture).
- **Navigation**: React Navigation v7, utilizing a root stack, bottom tab navigator (Search, Shows, Library, Profile), and nested stack navigators. The Library screen features inner tabs for Episodes and Summaries.
- **State Management**: React Query for server state and caching; React Context for authentication and audio player state.
- **Styling**: Custom theme system with a premium editorial aesthetic, dark mode by default, and gold accent colors.
- **Animation**: React Native Reanimated for performant UI animations.
- **Audio**: `expo-audio` for podcast and summary playback, including background audio support and lock screen controls.
- **UI/UX Decisions**: Consistent screen layouts, specific button and input styling, two-column podcast detail headers, SegmentedControl, and a 4-slide onboarding carousel. Library screen features Spotify-style item cards with integrated actions and optimistic updates.
- **Audio Progress Tracking**: Implemented `audio_engagement_events` to log listening duration and completion, syncing progress to the database and automatically marking content as complete at 75% playback. Engagement events include `client_platform: 'mobile'`, UUID sanitization for episodes (strips `episode-` prefix), and deduplication checks for start events.
- **Analytics Event Tracking**: Centralized via `client/lib/analytics.ts`. Tracks 6 event types in `analytics_events` table: `site_visit` (cold start), `podcast_searched` (5-min debounce), `summary_generated`, `audio_played`, `full_episode_played`, `share_initiated`. All events include `client_platform: 'mobile'`. Reference: `docs/Mobile_Analytics_Reference.md`.
- **Expanded Player UX**: Includes skip labels, a "Next" button for queue progression, and local state for progress bar seeking.
- **Playlist Queue System**: `playWithQueue` function for playing with a queue, with Library tabs auto-populating queues.
- **Autoplay Next Item**: Uses `expo-audio`'s `didJustFinish` for reliable end detection, marking items complete and handling app state recovery.
- **Previous Track / History Tracking**: `playPrevious()` function to restart current track or jump to previous, with a history state maintaining the last 50 played items.
- **Remote Command Listeners**: Registered for play, pause, next, and previous track commands for headphone and lock screen controls.
- **Offline Mode**: Uses `@react-native-community/netinfo` for network detection. Non-downloaded items are disabled offline, and downloaded items remain fully functional. Downloads are treated as attributes of episodes/summaries with a circular progress UI.
- **Pricing & Upgrade Flow**: Dedicated PricingScreen with plan comparison and ROI calculator. An `UpgradeBanner` provides context-dependent calls to action.
- **Push Notifications**: Uses `expo-notifications` for registration, token storage in Supabase, and a notification handler for deep linking to summaries.
- **Referral Workflow (V1)**: Focuses on sharing functionality and signup attribution. Share URLs include referral parameters, and a `log-share-visit` edge function tracks shares. Signup attribution is handled via Supabase auth metadata.
- **Analytics Screen**: Accessible from Profile > Account > Analytics. Displays user listening stats via `user-analytics` edge function. Features: date filter (7d/30d/90d/1yr/custom), 2x2 summary cards (Time Saved, Summaries, Episodes, Shows), horizontal bar chart (favorite podcasts), donut chart (genre breakdown), activity line chart with Daily/Cumulative toggle, summaries vs episodes donut, time saved line chart. All charts built with custom react-native-svg components. Handles loading skeleton, empty, and error states.

### Backend

- **Server**: Express.js with TypeScript, primarily hosting Supabase Edge Functions.
- **Database**: PostgreSQL hosted on Supabase, managed with Drizzle ORM.
- **Authentication**: Supabase Auth with email/password.
- **API Pattern**: Business logic is primarily handled by Supabase Edge Functions (e.g., podcast search, brief generation, billing), complemented by REST API for direct database interactions.

### Data Storage

- **Primary Database**: Supabase PostgreSQL for profiles, briefs, followed podcasts, and saved episodes.
- **Local Storage**: AsyncStorage for session persistence, `expo-file-system` for offline audio, and `expo-secure-store` for sensitive data.

### Key Design Patterns

- **Path Aliases**: Standardized aliases (`@/`, `@shared/`).
- **Theming**: Centralized theme constants for consistent UI.
- **Component Structure**: Atomic design principles for reusable UI components.

## External Dependencies

- **Supabase**: Database, authentication, Edge Functions, storage.
- **Taddy API**: Podcast catalog search and metadata.
- **Google Gemini 3 Flash / 2.5 Pro**: AI summarization and transcript condensation.
- **Deepgram Nova-2**: Fallback transcription.
- **OpenAI TTS-1**: Text-to-speech for audio summaries.
- **Stripe**: Subscription billing and credit pack purchases.
- **Resend**: Transactional email delivery.
- **Loops.so**: Marketing automation.
- **PostHog**: Analytics.