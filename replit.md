# PodBrief

## Overview

PodBrief is an AI-powered cross-platform mobile application built with Expo/React Native, designed to help busy professionals efficiently consume podcast content. It offers full episode listening and AI-generated audio summaries. Users can search, follow, save episodes, generate AI briefs with text-to-speech, and manage offline downloads. The project aims to provide a streamlined podcast experience, emphasizing efficiency and content accessibility.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

- **Framework**: Expo SDK 54 with React Native 0.81 (new architecture).
- **Navigation**: React Navigation v7, featuring a root stack for auth/modals, a bottom tab navigator (Search, Shows, Library, Profile), and nested stack navigators. The Library screen includes inner tabs for Episodes, Summaries, and Downloads.
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

## Recent Audio Player Improvements

- **iOS Silent Mode Fix**: `setAudioModeAsync` is now called before each `play()` and `resume()` action to ensure `playsInSilentMode: true` is always active
- **ExpandedPlayer UX**:
  - Skip labels (15s) display below icons with proper spacing
  - Added "Next" button (skip-forward icon) to play next item in queue
  - Progress bar seeking uses local state during drag for immediate visual feedback before actual seek