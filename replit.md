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
  - Bottom tab navigator with 5 tabs (Discover, Shows, Library, Downloads, Profile)
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
- **Authentication**: Supabase Auth with email/password and Google SSO support
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
- **Key Edge Functions**: `taddy-search`, `create-checkout`, `customer-portal`

### Key NPM Packages

- `@supabase/supabase-js` - Supabase client
- `@tanstack/react-query` - Data fetching and caching
- `expo-audio` - Audio playback
- `expo-file-system` - File management for downloads
- `drizzle-orm` / `drizzle-zod` - Database ORM and validation
- `react-native-reanimated` - Animations
- `expo-blur` / `expo-linear-gradient` - Visual effects