# PodBrief Mobile Integration Guide

> Best practices and patterns for building iOS/Android apps that integrate with PodBrief.

**Last Updated:** February 2, 2026

---

## Table of Contents

1. [Authentication Setup](#authentication-setup)
2. [Platform Detection](#platform-detection)
3. [Audio Playback Architecture](#audio-playback-architecture)
4. [Offline Download Strategy](#offline-download-strategy)
5. [Library Data Sync](#library-data-sync)
6. [Integration Patterns](#integration-patterns)
7. [Screen-Specific Data Requirements](#screen-specific-data-requirements)
8. [Marketing Sync (Loops.so)](#marketing-sync-loopsso)
9. [Deduplication Strategies](#deduplication-strategies)
10. [Push Notifications (Future)](#push-notifications-future)
11. [Error Handling Patterns](#error-handling-patterns)

---

## Authentication Setup

### Initialize Supabase Client

```typescript
// config/supabase.ts
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = 'https://wdylkaiyoelfcmphoaqs.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndkeWxrYWl5b2VsZmNtcGhvYXFzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY1MjcwMTQsImV4cCI6MjA4MjEwMzAxNH0.h9kbq-ABILY3ZrIZdWIimzJhdyGz-Cq1eztkEiCBKDk';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
```

### Email/Password Authentication

```typescript
// Sign Up
async function signUp(email: string, password: string, firstName?: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        first_name: firstName,
        preferred_language: 'en',
      },
      emailRedirectTo: 'podbrief://auth/callback',
    },
  });
  
  if (error) throw error;
  return data;
}

// Sign In
async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  
  if (error) throw error;
  return data;
}

// Sign Out
async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
```

### Google OAuth (Browser-Based - Unified)

Mobile uses the same browser-based OAuth flow as web. This is simpler and uses Lovable Cloud's managed Google OAuth - no separate iOS/Android client IDs needed.

```typescript
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { supabase } from './supabase';

// For Expo, ensure web browser redirects are handled
WebBrowser.maybeCompleteAuthSession();

async function signInWithGoogle() {
  // Get the redirect URI for your app
  const redirectUri = makeRedirectUri({
    scheme: 'podbrief', // Your app's URL scheme
    path: 'auth/callback',
  });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectUri,
      skipBrowserRedirect: true, // We'll handle the browser ourselves
    },
  });

  if (error) throw error;

  // Open the auth URL in an in-app browser
  const result = await WebBrowser.openAuthSessionAsync(
    data.url!,
    redirectUri
  );

  if (result.type === 'success') {
    // Extract tokens from the URL and set the session
    const url = new URL(result.url);
    const params = new URLSearchParams(url.hash.slice(1)); // Remove #
    
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    
    if (accessToken && refreshToken) {
      await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
    }
  }
}
```

**For Capacitor apps:**
```typescript
import { Browser } from '@capacitor/browser';

async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: 'podbrief://auth/callback', // Your app's deep link
    },
  });

  if (error) throw error;
  
  // Capacitor handles the redirect automatically via deep links
  await Browser.open({ url: data.url! });
}
```

**Important Notes:**
- Uses the same Lovable Cloud managed Google OAuth as web
- No separate iOS/Android client IDs needed
- Configure deep linking in your app (see Deep Linking section below)
- Works on both iOS and Android without app store verification

### Session Management

```typescript
// Listen for auth state changes
useEffect(() => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (event, session) => {
      setUser(session?.user ?? null);
      setSession(session);
      
      if (event === 'SIGNED_OUT') {
        // Clear local data
        clearLocalStorage();
      }
    }
  );

  // Check for existing session
  supabase.auth.getSession().then(({ data: { session } }) => {
    setSession(session);
    setUser(session?.user ?? null);
  });

  return () => subscription.unsubscribe();
}, []);
```

### Token Refresh

The Supabase client handles token refresh automatically. For manual refresh:

```typescript
async function refreshSession() {
  const { data, error } = await supabase.auth.refreshSession();
  if (error) {
    // Token expired or invalid - sign out user
    await supabase.auth.signOut();
    return null;
  }
  return data.session;
}
```

---

## Platform Detection

### Overview

The web app includes a platform detection utility that differentiates between browser environments and native Capacitor apps. This allows platform-specific behavior without code duplication.

### When Running as Native App

The native iOS/Android apps built with Capacitor should use native audio APIs directly, bypassing browser-specific workarounds like:
- Visibility change handlers for background audio
- User gesture requirements for `audio.play()`
- `setTimeout` throttling workarounds

### Web App Reference Implementation

The web app uses `src/lib/platform.ts`:

```typescript
// Platform detection for native vs browser
let isNative: boolean | null = null;

export function isNativePlatform(): boolean {
  if (isNative !== null) return isNative;
  
  // Check for Capacitor
  if (typeof window !== 'undefined' && window.Capacitor?.isNativePlatform) {
    isNative = window.Capacitor.isNativePlatform();
  } else {
    isNative = false;
  }
  
  return isNative;
}

export function isBrowser(): boolean {
  return !isNativePlatform();
}
```

### Native App Implications

When building the native apps:

1. **Background Audio**: Native apps have proper background audio support via iOS/Android APIs. No need for the `pendingAutoAdvanceRef` workaround used in browsers.

2. **Auto-Advance**: Queue auto-advance should work immediately when a track ends, without checking visibility state.

3. **Capacitor Detection**: If using Capacitor, the `isNativePlatform()` function will automatically return `true`, enabling the web codebase to skip browser workarounds.

### Recommended Native Approach

For React Native or native Swift/Kotlin:
- Use platform-native audio players (AVPlayer on iOS, ExoPlayer on Android)
- Implement background audio entitlements/permissions
- Handle audio focus and interruptions natively
- Auto-advance works without browser restrictions

---

## Audio Playback Architecture

### Two Audio Types

PodBrief has two distinct audio sources:

| Type | Source | Access Method | Storage |
|------|--------|---------------|---------|
| **Summary (TTS)** | AI-generated narration | Signed URL via `get-signed-audio-url` | Protected bucket |
| **Full Episode** | Original podcast audio | Direct URL from Taddy | External CDN |

### Playing Summary Audio

```typescript
// 1. Get signed URL (valid 15 minutes)
async function getAudioUrl(masterBriefId: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke('get-signed-audio-url', {
    body: { masterBriefId },
  });
  
  if (error) throw error;
  return data.signedUrl;
}

// 2. Handle URL expiry during playback
class AudioPlayer {
  private currentMasterBriefId: string | null = null;
  private urlExpiresAt: Date | null = null;
  
  async play(masterBriefId: string) {
    this.currentMasterBriefId = masterBriefId;
    const url = await this.getOrRefreshUrl();
    // Use your audio library (expo-av, react-native-sound, etc.)
    await this.playUrl(url);
  }
  
  private async getOrRefreshUrl(): Promise<string> {
    const now = new Date();
    const bufferMs = 60 * 1000; // Refresh 1 minute before expiry
    
    if (!this.urlExpiresAt || now.getTime() > this.urlExpiresAt.getTime() - bufferMs) {
      const url = await getAudioUrl(this.currentMasterBriefId!);
      this.urlExpiresAt = new Date(now.getTime() + 15 * 60 * 1000);
      return url;
    }
    
    return this.cachedUrl!;
  }
}
```

### Playing Full Episodes

```typescript
// Full episodes stream directly from the podcast's CDN
async function playFullEpisode(audioUrl: string) {
  // No signing needed - direct URL
  await audioPlayer.loadAsync({ uri: audioUrl });
  await audioPlayer.playAsync();
}
```

### Progress Tracking

```typescript
// For Summary Briefs - update user_briefs table
async function updateBriefProgress(userBriefId: string, progressSeconds: number) {
  await supabase
    .from('user_briefs')
    .update({ 
      audio_progress_seconds: progressSeconds,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userBriefId);
}

// For Full Episodes - update saved_episodes table  
async function updateEpisodeProgress(
  savedEpisodeId: string, 
  progressSeconds: number,
  totalDuration: number
) {
  const isCompleted = progressSeconds / totalDuration >= 0.75;
  
  await supabase
    .from('saved_episodes')
    .update({ 
      audio_progress_seconds: progressSeconds,
      is_completed: isCompleted,
      updated_at: new Date().toISOString(),
    })
    .eq('id', savedEpisodeId);
}
```

### Playback Speed

Supported speeds: `0.5x, 0.75x, 0.9x, 1x, 1.1x, 1.25x, 1.5x, 1.75x, 2x`

```typescript
const SPEED_OPTIONS = [0.5, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2];

// Persist preference locally
async function setPlaybackSpeed(speed: number) {
  await AsyncStorage.setItem('playbackSpeed', speed.toString());
  audioPlayer.setRateAsync(speed, true); // true = pitch corrected
}
```

### Engagement Events

Log audio engagement for analytics:

```typescript
// Log "start" event after 30 seconds of listening
async function logAudioStart(
  masterBriefId: string, 
  audioType: 'summary' | 'full_episode',
  duration: number
) {
  const sessionId = generateUUID();
  
  await supabase.from('audio_engagement_events').insert({
    user_id: user.id,
    master_brief_id: masterBriefId,
    audio_type: audioType,
    event_type: 'start',
    duration_seconds: duration,
    progress_seconds: 30,
    progress_percentage: Math.round((30 / duration) * 100),
    session_id: sessionId,
  });
  
  return sessionId;
}

// Log "completion" event at 75% progress
async function logAudioCompletion(
  masterBriefId: string,
  audioType: 'summary' | 'full_episode', 
  duration: number,
  progressSeconds: number,
  sessionId: string
) {
  await supabase.from('audio_engagement_events').insert({
    user_id: user.id,
    master_brief_id: masterBriefId,
    audio_type: audioType,
    event_type: 'completion',
    duration_seconds: duration,
    progress_seconds: progressSeconds,
    progress_percentage: 75,
    session_id: sessionId,
  });
}
```

---

## Offline Download Strategy

### Overview

PodBrief's backend is read-only for downloads - no backend changes needed. The mobile app handles all download logic locally.

### Download Flow

```typescript
import * as FileSystem from 'expo-file-system';

const DOWNLOADS_DIR = `${FileSystem.documentDirectory}downloads/`;

// 1. Get signed URL for summary audio
async function downloadSummaryAudio(masterBriefId: string, briefSlug: string) {
  // Get signed URL
  const { data } = await supabase.functions.invoke('get-signed-audio-url', {
    body: { masterBriefId },
  });
  
  const signedUrl = data.signedUrl;
  const localPath = `${DOWNLOADS_DIR}briefs/${masterBriefId}.mp3`;
  
  // Ensure directory exists
  await FileSystem.makeDirectoryAsync(`${DOWNLOADS_DIR}briefs/`, { 
    intermediates: true 
  });
  
  // Download file
  const downloadResult = await FileSystem.downloadAsync(
    signedUrl,
    localPath
  );
  
  if (downloadResult.status === 200) {
    // Save to local database
    await saveDownloadRecord({
      master_brief_id: masterBriefId,
      brief_slug: briefSlug,
      local_path: localPath,
      downloaded_at: new Date().toISOString(),
      file_size: downloadResult.headers['Content-Length'],
    });
  }
  
  return downloadResult;
}

// 2. Download full episode (direct URL, no signing)
async function downloadFullEpisode(
  taddyEpisodeUuid: string,
  audioUrl: string,
  episodeName: string
) {
  const localPath = `${DOWNLOADS_DIR}episodes/${taddyEpisodeUuid}.mp3`;
  
  await FileSystem.makeDirectoryAsync(`${DOWNLOADS_DIR}episodes/`, { 
    intermediates: true 
  });
  
  const downloadResult = await FileSystem.downloadAsync(
    audioUrl,
    localPath
  );
  
  if (downloadResult.status === 200) {
    await saveDownloadRecord({
      taddy_episode_uuid: taddyEpisodeUuid,
      episode_name: episodeName,
      local_path: localPath,
      downloaded_at: new Date().toISOString(),
      file_size: downloadResult.headers['Content-Length'],
    });
  }
  
  return downloadResult;
}
```

### Local SQLite Schema for Downloads

```sql
-- Track downloaded content
CREATE TABLE downloads (
  id TEXT PRIMARY KEY,
  master_brief_id TEXT,
  taddy_episode_uuid TEXT,
  content_type TEXT NOT NULL, -- 'summary' or 'episode'
  local_path TEXT NOT NULL,
  downloaded_at TEXT NOT NULL,
  file_size INTEGER,
  last_played_at TEXT,
  playback_position INTEGER DEFAULT 0
);

-- Index for quick lookups
CREATE INDEX idx_downloads_brief ON downloads(master_brief_id);
CREATE INDEX idx_downloads_episode ON downloads(taddy_episode_uuid);
```

### Playing Offline Content

```typescript
async function playOfflineContent(contentId: string, type: 'summary' | 'episode') {
  const column = type === 'summary' ? 'master_brief_id' : 'taddy_episode_uuid';
  
  // Check local database
  const download = await db.getFirstAsync(
    `SELECT * FROM downloads WHERE ${column} = ?`,
    [contentId]
  );
  
  if (download) {
    // Check file exists
    const fileInfo = await FileSystem.getInfoAsync(download.local_path);
    
    if (fileInfo.exists) {
      // Play locally
      return { uri: download.local_path, isOffline: true };
    } else {
      // File deleted, remove record
      await db.runAsync('DELETE FROM downloads WHERE id = ?', [download.id]);
    }
  }
  
  return null; // Not available offline
}
```

### Sync Progress on Reconnect

```typescript
async function syncOfflineProgress() {
  if (!isOnline) return;
  
  // Get all pending progress updates
  const pending = await db.getAllAsync(
    'SELECT * FROM downloads WHERE playback_position > 0'
  );
  
  for (const item of pending) {
    if (item.master_brief_id) {
      // Find the user_brief for this master_brief
      const { data: userBrief } = await supabase
        .from('user_briefs')
        .select('id')
        .eq('master_brief_id', item.master_brief_id)
        .eq('user_id', user.id)
        .single();
      
      if (userBrief) {
        await supabase
          .from('user_briefs')
          .update({ audio_progress_seconds: item.playback_position })
          .eq('id', userBrief.id);
      }
    } else if (item.taddy_episode_uuid) {
      await supabase
        .from('saved_episodes')
        .update({ audio_progress_seconds: item.playback_position })
        .eq('taddy_episode_uuid', item.taddy_episode_uuid)
        .eq('user_id', user.id);
    }
  }
}
```

---

## Library Data Sync

### Fetching User's Library

```typescript
// Get all briefs
async function fetchUserBriefs() {
  const { data, error } = await supabase
    .from('user_briefs')
    .select(`
      id,
      slug,
      is_completed,
      audio_progress_seconds,
      is_gifted,
      created_at,
      master_brief:master_briefs(
        id,
        episode_name,
        podcast_name,
        episode_thumbnail,
        summary_text,
        audio_url,
        audio_duration_seconds,
        pipeline_status
      )
    `)
    .eq('is_hidden', false)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data;
}

// Get saved episodes
async function fetchSavedEpisodes() {
  const { data, error } = await supabase
    .from('saved_episodes')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data;
}

// Get followed podcasts
async function fetchFollowedPodcasts() {
  const { data, error } = await supabase
    .from('followed_podcasts')
    .select('*')
    .order('podcast_name', { ascending: true });
  
  if (error) throw error;
  return data;
}
```

### Optimistic Updates

```typescript
// Example: Marking brief as completed
async function markBriefCompleted(userBriefId: string) {
  // Optimistic update - update UI immediately
  setLocalBriefState(userBriefId, { is_completed: true });
  
  try {
    await supabase
      .from('user_briefs')
      .update({ is_completed: true })
      .eq('id', userBriefId);
  } catch (error) {
    // Rollback on failure
    setLocalBriefState(userBriefId, { is_completed: false });
    throw error;
  }
}
```

### Real-time Subscriptions (Optional)

```typescript
// Subscribe to brief status updates (useful during generation)
function subscribeToBriefUpdates(masterBriefId: string, onUpdate: (brief) => void) {
  const channel = supabase
    .channel(`brief-${masterBriefId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'master_briefs',
        filter: `id=eq.${masterBriefId}`,
      },
      (payload) => {
        onUpdate(payload.new);
      }
    )
    .subscribe();
  
  return () => {
    supabase.removeChannel(channel);
  };
}
```

---

## Integration Patterns

### Fire-and-Forget Pattern

The web app uses a "fire-and-forget" pattern for non-critical operations like metadata registration and marketing sync. These calls happen asynchronously and failures don't block the main user flow.

**Key Principle:** The primary database operation (insert/update) completes first, then secondary operations are fired without waiting for their results.

**Example: Saving an Episode**
```typescript
async function saveEpisode(episode: Episode) {
  // 1. PRIMARY: Insert into saved_episodes (this MUST succeed)
  const { error } = await supabase.from('saved_episodes').insert({
    user_id: user.id,
    taddy_episode_uuid: episode.uuid,
    taddy_podcast_uuid: episode.podcastUuid,
    episode_name: episode.name,
    podcast_name: episode.podcastName,
    episode_thumbnail: episode.imageUrl,
    episode_audio_url: episode.audioUrl,
    episode_duration_seconds: episode.duration,
    episode_published_at: new Date(episode.datePublished).toISOString(),
  });
  
  if (error) throw error;
  
  // 2. FIRE-AND-FORGET: Register public metadata
  // This enables sharing but isn't required for the save to work
  supabase.functions.invoke('ensure-episode-metadata', {
    body: {
      taddyEpisodeUuid: episode.uuid,
      taddyPodcastUuid: episode.podcastUuid,
      name: episode.name,
      podcastName: episode.podcastName,
      imageUrl: episode.imageUrl,
      audioUrl: episode.audioUrl,
      durationSeconds: episode.duration,
      publishedAt: new Date(episode.datePublished).toISOString(),
    },
  }).catch(err => console.error('ensure-episode-metadata error:', err));
  
  // 3. Show success toast immediately (don't wait for step 2)
  showToast('Episode saved to library');
}
```

**Example: Following a Podcast**
```typescript
async function followPodcast(podcast: Podcast) {
  // 1. PRIMARY: Insert into followed_podcasts
  const { error } = await supabase.from('followed_podcasts').insert({
    user_id: user.id,
    taddy_podcast_uuid: podcast.uuid,
    podcast_name: podcast.name,
    podcast_description: podcast.description,
    podcast_image_url: podcast.imageUrl,
    author_name: podcast.authorName,
    total_episodes_count: podcast.totalEpisodesCount,
  });
  
  if (error) throw error;
  
  // 2. FIRE-AND-FORGET: Register public metadata for SEO
  supabase.functions.invoke('ensure-podcast-metadata', {
    body: {
      taddyPodcastUuid: podcast.uuid,
      name: podcast.name,
      description: podcast.description,
      imageUrl: podcast.imageUrl,
      authorName: podcast.authorName,
      totalEpisodesCount: podcast.totalEpisodesCount,
    },
  }).catch(err => console.error('ensure-podcast-metadata error:', err));
  
  // 3. FIRE-AND-FORGET: Sync engagement to marketing (Loops)
  supabase.rpc('get_user_engagement', { p_user_id: user.id })
    .then(({ data }) => {
      if (data) {
        supabase.functions.invoke('sync-to-loops', {
          body: {
            action: 'engagement_update',
            email: user.email,
            showsFollowed: data.shows_followed,
          },
        }).catch(console.error);
      }
    })
    .catch(console.error);
  
  showToast('Following ' + podcast.name);
}
```

---

### When to Call Metadata Functions

The metadata functions (`ensure-episode-metadata`, `ensure-podcast-metadata`) create public SEO-friendly URLs. Call them whenever an item might be shared.

| User Action | Edge Function to Call | Purpose |
|-------------|----------------------|---------|
| Save episode to library | `ensure-episode-metadata` | Enable public sharing URLs |
| Download episode | `ensure-episode-metadata` | Ensure slug exists for offline item |
| Follow a podcast | `ensure-podcast-metadata` | Enable public show pages |
| Download brief | None needed | Brief generation already creates metadata |
| Generate brief | None needed | `generate-taddy-brief` handles metadata |
| Claim shared brief | None needed | Brief already has metadata |

**Key Principle:** Any item that could be shared needs its metadata registered.

**When NOT to call:**
- Viewing content (read-only, no state change)
- Playing audio (no sharing involved)
- Updating progress (internal state only)

---

## Screen-Specific Data Requirements

This section documents which data sources and Edge Functions to use for each mobile screen. **Critical:** Using the wrong data source will cause missing fields or errors.

### Data Source Matrix

| Screen | Primary Data Source | Edge Function | Key Notes |
|--------|---------------------|---------------|-----------|
| **Episode Details** | `episode_metadata` | `get-episode-details` | **Required** - returns description, auto-backfills from Taddy |
| **Brief Details** | `master_briefs` | Direct DB query | Join via `user_briefs` → `master_briefs` |
| **Show/Podcast Page** | `podcast_metadata` | `get-show-discovery` | Returns show info + latest briefs |
| **Episode List (Show)** | Taddy API | `get-show-episodes` | Paginated episodes with brief status |
| **Explore** | Aggregated data | `get-explore-shows` | Popular shows sorted by brief count |
| **Library (Briefs)** | `user_briefs` + `master_briefs` | Direct DB query | Join tables for full brief data |
| **Library (Episodes)** | `saved_episodes` | Direct DB query | Per-user playback state only |

---

### Episode Details Screen

**IMPORTANT:** The Episode Details screen MUST call `get-episode-details` to fetch episode descriptions. The `saved_episodes` table does NOT contain descriptions by design.

#### Why This Matters

The data is split between two tables:

| Table | Purpose | Contains Description? |
|-------|---------|----------------------|
| `saved_episodes` | Per-user library data (playback progress, completion) | ❌ **NO** |
| `episode_metadata` | Global/public data (SEO, sharing, descriptions) | ✅ **YES** |

This separation allows public episode pages without exposing user data.

#### Implementation

```typescript
// Episode Details screen - ALWAYS call this Edge Function
async function fetchEpisodeDetails(slug: string) {
  const { data, error } = await supabase.functions.invoke('get-episode-details', {
    body: { slug },
  });
  
  if (error) throw error;
  
  // data.episode contains:
  // - id, slug, name
  // - description (may be auto-backfilled from Taddy if missing)
  // - imageUrl, audioUrl, durationSeconds, publishedAt
  // - podcastName, podcastSlug, podcastImageUrl
  // - briefSlug (if a completed brief exists)
  // - taddyEpisodeUuid, taddyPodcastUuid
  return data.episode;
}
```

#### How Taddy Backfill Works

The `get-episode-details` function automatically handles missing descriptions:

1. Checks `episode_metadata.description`
2. If null, calls Taddy API (`getPodcastEpisode` query)
3. Stores the result in the database for future requests
4. Returns the description in the response

This means the first request for an episode may be slightly slower, but subsequent requests are instant.

---

### Schema Reference

#### `saved_episodes` Columns (Per-User Library Data)

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `user_id` | uuid | Owner of this saved episode |
| `taddy_episode_uuid` | text | Taddy episode identifier |
| `taddy_podcast_uuid` | text | Taddy podcast identifier |
| `episode_name` | text | Episode title |
| `podcast_name` | text | Podcast title |
| `episode_thumbnail` | text | Image URL |
| `episode_audio_url` | text | Direct audio URL |
| `episode_duration_seconds` | integer | Duration |
| `episode_published_at` | timestamp | Publish date |
| `is_completed` | boolean | User finished listening |
| `audio_progress_seconds` | integer | Playback position |
| **NO `description` column** | - | **Descriptions are in `episode_metadata`** |

#### `episode_metadata` Columns (Global/Public Data)

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `slug` | text | SEO-friendly URL slug |
| `taddy_episode_uuid` | text | Taddy episode identifier |
| `taddy_podcast_uuid` | text | Taddy podcast identifier |
| `name` | text | Episode title |
| `description` | text | Full episode description (backfilled from Taddy) |
| `image_url` | text | Episode image |
| `audio_url` | text | Direct audio URL |
| `duration_seconds` | integer | Duration |
| `published_at` | timestamp | Publish date |
| `podcast_name` | text | Podcast title |
| `podcast_slug` | text | Podcast URL slug |
| `podcast_image_url` | text | Podcast image |
| `master_brief_id` | uuid | Link to brief if one exists |

---

### Getting Episode Slug from Saved Episode

When navigating from Library (Episodes) to Episode Details, you need the episode slug. There are two approaches:

#### Option 1: Generate Slug Client-Side (Recommended)

```typescript
// Same logic as backend - consistent slug generation
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 100); // Limit length
}

// Usage when navigating from saved episode
const slug = generateSlug(savedEpisode.episode_name);
const details = await fetchEpisodeDetails(slug);
```

#### Option 2: Query Episode Metadata by Taddy UUID

```typescript
// If you need the exact slug from the database
const { data } = await supabase
  .from('episode_metadata')
  .select('slug')
  .eq('taddy_episode_uuid', savedEpisode.taddy_episode_uuid)
  .maybeSingle();

if (data?.slug) {
  const details = await fetchEpisodeDetails(data.slug);
}
```

---

## Marketing Sync (Loops.so)

The web app syncs user engagement to Loops.so for email marketing automation. Mobile should implement the same patterns.

### Trigger Points

| Trigger | Action | Payload |
|---------|--------|---------|
| User signs up | `signup` | email, firstName, userId, preferredLanguage, credits (5) |
| Pro subscription starts | `upgraded` | email, userId, firstName |
| Subscription cancelled | `downgraded` | email, userId, firstName |
| Follow a show | `engagement_update` | email, showsFollowed (from DB count) |
| Unfollow a show | `engagement_update` | email, showsFollowed (from DB count) |
| Generate brief | `engagement_update` | email, briefsGenerated, lastBriefDate |

### Getting Accurate Counts

**Important:** Don't track counts locally - always fetch from the database to ensure accuracy across devices.

```typescript
// Use the RPC function for accurate engagement metrics
async function getEngagementMetrics(userId: string) {
  const { data, error } = await supabase.rpc('get_user_engagement', { 
    p_user_id: userId 
  });
  
  if (error) throw error;
  
  return {
    showsFollowed: data.shows_followed,
    briefsGenerated: data.briefs_generated,
    lastBriefDate: data.last_brief_date,
  };
}
```

### Implementation Examples

**After Signup:**
```typescript
async function handleSignup(user: User, profile: Profile) {
  // Fire-and-forget: Sync to Loops
  supabase.functions.invoke('sync-to-loops', {
    body: {
      action: 'signup',
      email: user.email,
      userId: user.id,
      firstName: profile.first_name,
      plan: 'free',
      credits: 5,
      preferredLanguage: profile.preferred_language,
    },
  }).catch(err => console.error('Loops sync error:', err));
}
```

**After Following/Unfollowing:**
```typescript
async function syncFollowChange(userId: string, email: string) {
  try {
    const metrics = await getEngagementMetrics(userId);
    
    await supabase.functions.invoke('sync-to-loops', {
      body: {
        action: 'engagement_update',
        email,
        showsFollowed: metrics.showsFollowed,
      },
    });
  } catch (err) {
    console.error('Loops sync error:', err);
  }
}
```

**After Brief Generation:**
```typescript
async function syncBriefGenerated(userId: string, email: string) {
  try {
    const metrics = await getEngagementMetrics(userId);
    
    await supabase.functions.invoke('sync-to-loops', {
      body: {
        action: 'engagement_update',
        email,
        briefsGenerated: metrics.briefsGenerated,
        lastBriefDate: metrics.lastBriefDate,
      },
    });
  } catch (err) {
    console.error('Loops sync error:', err);
  }
}
```

---

## Deduplication Strategies

PodBrief uses multiple layers of deduplication to prevent duplicate records and handle race conditions.

### Database Level

Unique constraints prevent duplicate records:

| Table | Unique Constraint | Purpose |
|-------|-------------------|---------|
| `saved_episodes` | `(user_id, taddy_episode_uuid)` | One save per user per episode |
| `followed_podcasts` | `(user_id, taddy_podcast_uuid)` | One follow per user per podcast |
| `episode_metadata` | `taddy_episode_uuid` | Global episode registry |
| `podcast_metadata` | `taddy_podcast_uuid` | Global podcast registry |
| `user_briefs` | `(user_id, master_brief_id)` | One brief per user per master |
| `master_briefs` | `(taddy_episode_uuid, language)` | One master per episode per language |

### Client Level

Before showing "Add" or "Follow" buttons, check existing state:

```typescript
// Check if episode is already saved
function isEpisodeSaved(savedEpisodes: SavedEpisode[], episodeUuid: string): boolean {
  return savedEpisodes.some(ep => ep.taddy_episode_uuid === episodeUuid);
}

// Check if podcast is already followed
function isPodcastFollowed(followedPodcasts: FollowedPodcast[], podcastUuid: string): boolean {
  return followedPodcasts.some(p => p.taddy_podcast_uuid === podcastUuid);
}

// Example UI
function EpisodeCard({ episode, savedEpisodes }) {
  const isSaved = isEpisodeSaved(savedEpisodes, episode.uuid);
  
  return (
    <Button 
      onPress={() => isSaved ? removeSavedEpisode(episode.uuid) : saveEpisode(episode)}
      variant={isSaved ? 'outline' : 'default'}
    >
      {isSaved ? 'Saved' : 'Save'}
    </Button>
  );
}
```

### Edge Function Level

All `ensure-*` functions handle race conditions:

```typescript
// Inside ensure-episode-metadata (simplified)
try {
  await supabase.from('episode_metadata').insert({ ... });
} catch (error) {
  // Postgres error 23505 = unique violation (race condition)
  if (error.code === '23505') {
    // Another request already created it - fetch and return existing
    const { data } = await supabase
      .from('episode_metadata')
      .select('slug')
      .eq('taddy_episode_uuid', episodeUuid)
      .single();
    
    return { slug: data.slug, created: false };
  }
  throw error;
}
```

### Handling Insert Conflicts

When inserting user content, handle conflicts gracefully:

```typescript
async function saveEpisodeWithConflictHandling(episode: Episode) {
  const { error } = await supabase.from('saved_episodes').insert({
    user_id: user.id,
    taddy_episode_uuid: episode.uuid,
    // ... other fields
  });
  
  if (error) {
    // Check if it's a duplicate key error
    if (error.code === '23505') {
      // Already saved - this is fine, treat as success
      console.log('Episode already saved');
      return { alreadySaved: true };
    }
    throw error;
  }
  
  return { alreadySaved: false };
}
```

---

## Push Notifications (Future)

> **Note:** Push notification backend is not yet implemented. This section describes the planned architecture for when you're ready to set up Firebase.

### Planned Architecture

```
┌─────────────┐     ┌──────────────────────┐     ┌─────────────┐
│  Mobile App │────►│  register-device     │────►│ FCM/APNs    │
│             │     │  -token function     │     │             │
└─────────────┘     └──────────────────────┘     └─────────────┘
                              │
                              ▼
                    ┌──────────────────────┐
                    │    device_tokens     │
                    │    (future table)    │
                    └──────────────────────┘
```

### Expected Mobile Implementation

When push notifications are enabled:

```typescript
// 1. Request permission and get FCM token
import messaging from '@react-native-firebase/messaging';

async function registerForPushNotifications() {
  const authStatus = await messaging().requestPermission();
  
  if (authStatus === messaging.AuthorizationStatus.AUTHORIZED) {
    const token = await messaging().getToken();
    
    // Register with backend
    await supabase.functions.invoke('register-device-token', {
      body: {
        token,
        platform: Platform.OS,
        deviceName: DeviceInfo.getModel(),
      },
    });
  }
}

// 2. Handle incoming notifications
messaging().onMessage(async (remoteMessage) => {
  if (remoteMessage.data?.type === 'brief_ready') {
    // Navigate to the brief or show local notification
    const briefSlug = remoteMessage.data.briefSlug;
    navigation.navigate('Brief', { slug: briefSlug });
  }
});

// 3. Handle notification when app opened from background
messaging().onNotificationOpenedApp((remoteMessage) => {
  if (remoteMessage.data?.type === 'brief_ready') {
    navigation.navigate('Brief', { slug: remoteMessage.data.briefSlug });
  }
});
```

### Expected Notification Payload

```typescript
interface BriefReadyNotification {
  notification: {
    title: "Brief Ready";
    body: "Your brief for 'Episode Name' is ready to listen";
  };
  data: {
    type: "brief_ready";
    briefSlug: string;
    masterBriefId: string;
  };
}
```

---

## Error Handling Patterns

### Global Error Handler

```typescript
// utils/errorHandler.ts
export async function handleApiError(error: Error, context: string) {
  console.error(`[${context}]`, error);
  
  // Log to backend (non-blocking)
  await supabase.functions.invoke('log-error', {
    body: {
      error_message: error.message,
      error_source: 'mobile_app',
      url: context,
      metadata: {
        platform: Platform.OS,
        version: DeviceInfo.getVersion(),
      },
    },
  }).catch(() => {}); // Ignore log failures
  
  // Show user-friendly message
  if (error.message.includes('network')) {
    showToast('Connection error. Please check your internet.');
  } else if (error.message.includes('401')) {
    // Token expired - trigger re-auth
    await supabase.auth.signOut();
    navigation.navigate('Login');
  } else {
    showToast('Something went wrong. Please try again.');
  }
}
```

### Retry Logic

```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  delayMs = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry on auth errors
      if (error.message?.includes('401') || error.message?.includes('403')) {
        throw error;
      }
      
      if (i < maxRetries - 1) {
        await new Promise(r => setTimeout(r, delayMs * Math.pow(2, i)));
      }
    }
  }
  
  throw lastError!;
}

// Usage
const briefs = await withRetry(() => fetchUserBriefs());
```

---

## Quick Reference

### Essential Imports

```typescript
import { supabase } from '@/config/supabase';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
```

### User Profile Access

```typescript
// Get current user's profile
const { data: profile } = await supabase
  .from('profiles')
  .select('*')
  .eq('id', user.id)
  .single();

// Profile fields:
interface Profile {
  id: string;
  email: string;
  first_name: string | null;
  credits: number;
  plan: 'free' | 'pro';
  preferred_language: string;
  pro_expires_at: string | null;
}
```

### Deep Linking

Configure for handling:
- `podbrief://auth/callback` - OAuth callback
- `podbrief://brief/:slug` - Open specific brief
- `podbrief://episode/:slug` - Open specific episode
- `https://podbrief.io/brief/:slug` - Universal link to brief

---

## Mobile Audit Findings & Required Fixes

> **Last Audit:** February 2, 2026  
> **Repository:** https://github.com/victorkung/PodBrief-Mobile-App

This section documents implementation gaps identified during code review, compared against the web implementation and this documentation.

---

### 🔴 Critical: Missing Audio Analytics Tracking

**File:** `client/contexts/AudioPlayerContext.tsx`

**Problem:** The mobile app does NOT track engagement events (`start`, `completion`) to `audio_engagement_events` table. This breaks analytics dashboards and user engagement metrics.

**Required Implementation:**

```typescript
// Add to AudioPlayerContext.tsx

// Configuration constants
const START_THRESHOLD_SECONDS = 30;
const COMPLETION_THRESHOLD_PERCENT = 75;

// Tracking state (reset per listening session)
const sessionIdRef = useRef<string | null>(null);
const hasLoggedStartRef = useRef(false);
const hasLoggedCompletionRef = useRef(false);
const accumulatedListenTimeRef = useRef(0);
const lastTimeUpdateRef = useRef(0);

// Generate session ID when starting new track
const startNewSession = () => {
  sessionIdRef.current = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  hasLoggedStartRef.current = false;
  hasLoggedCompletionRef.current = false;
  accumulatedListenTimeRef.current = 0;
  lastTimeUpdateRef.current = 0;
};

// Track accumulated listening time during timeupdate events
const handleTimeUpdate = (currentPosition: number) => {
  if (lastTimeUpdateRef.current > 0) {
    const delta = currentPosition - lastTimeUpdateRef.current;
    // Only count forward progress (<2s to filter seeks)
    if (delta > 0 && delta < 2) {
      accumulatedListenTimeRef.current += delta;
    }
  }
  lastTimeUpdateRef.current = currentPosition;
  
  // Check milestones
  checkEngagementMilestones(currentPosition);
};

// Log engagement events
const checkEngagementMilestones = async (currentPosition: number) => {
  if (!currentItem || !duration) return;
  
  const progressPercent = (currentPosition / (duration / 1000)) * 100;
  const audioType = currentItem.type === 'summary' ? 'summary' : 'full_episode';
  const masterBriefId = currentItem.type === 'summary' 
    ? currentItem.masterBriefId 
    : `episode-${currentItem.taddyEpisodeUuid}`;
  
  // Log START after 30 seconds accumulated listening
  if (!hasLoggedStartRef.current && accumulatedListenTimeRef.current >= START_THRESHOLD_SECONDS) {
    hasLoggedStartRef.current = true;
    
    await supabase.from('audio_engagement_events').insert({
      user_id: user.id,
      master_brief_id: masterBriefId,
      audio_type: audioType,
      event_type: 'start',
      duration_seconds: Math.round(duration / 1000),
      progress_seconds: Math.round(currentPosition),
      progress_percentage: Math.round(progressPercent * 100) / 100,
      session_id: sessionIdRef.current,
    });
  }
  
  // Log COMPLETION at 75% position
  if (!hasLoggedCompletionRef.current && progressPercent >= COMPLETION_THRESHOLD_PERCENT) {
    hasLoggedCompletionRef.current = true;
    
    await supabase.from('audio_engagement_events').insert({
      user_id: user.id,
      master_brief_id: masterBriefId,
      audio_type: audioType,
      event_type: 'completion',
      duration_seconds: Math.round(duration / 1000),
      progress_seconds: Math.round(currentPosition),
      progress_percentage: Math.round(progressPercent * 100) / 100,
      session_id: sessionIdRef.current,
    });
  }
};

// Call startNewSession() when play() is called with a new item
// Call handleTimeUpdate() in your progress interval
```

---

### 🔴 Critical: Summary Downloads Use Expired URLs

**File:** `client/screens/LibraryScreen.tsx` (line ~441)

**Problem:** `handleDownloadBrief` uses `brief.master_brief.audio_url` directly. This is a signed URL that expires in 15 minutes, making offline downloads fail.

**Current (Broken):**
```typescript
const response = await fetch(brief.master_brief.audio_url); // ❌ Expires!
```

**Required Fix:**
```typescript
const handleDownloadBrief = async (brief: UserBrief) => {
  // 1. Get a FRESH signed URL
  const { data, error } = await supabase.functions.invoke('get-signed-audio-url', {
    body: { masterBriefId: brief.master_brief_id },
  });
  
  if (error || !data?.signedUrl) {
    Alert.alert('Error', 'Failed to get download URL');
    return;
  }
  
  // 2. Download using the fresh URL
  const response = await fetch(data.signedUrl);
  // ... rest of download logic
};
```

---

### 🔴 Critical: No Language Filtering on Briefs

**File:** `client/screens/LibraryScreen.tsx` (line ~104)

**Problem:** Mobile fetches ALL `user_briefs` regardless of language. Users will see briefs in wrong languages.

**Current:**
```typescript
.eq('user_id', user.id)
.eq('is_hidden', false)
// Missing language filter!
```

**Required Fix:**
```typescript
const { data, error } = await supabase
  .from('user_briefs')
  .select(`
    *,
    master_brief:master_briefs!inner(
      id,
      language,
      ...
    )
  `)
  .eq('user_id', user.id)
  .eq('is_hidden', false)
  .eq('master_brief.language', profile?.preferred_language || 'en')  // ← ADD THIS
  .order('created_at', { ascending: false });
```

**Note:** The `!inner` join syntax ensures only matching briefs are returned.

---

### 🔴 Critical: No Database Progress Sync

**File:** `client/contexts/AudioPlayerContext.tsx`

**Problem:** Progress is saved only to AsyncStorage. When users switch devices, progress is lost.

**Required: Sync to Supabase periodically**

```typescript
// Add to saveProgress function or create separate syncProgress function
const syncProgressToDatabase = async () => {
  if (!currentItem || !user) return;
  
  const progressSeconds = Math.floor(position / 1000);
  
  if (currentItem.type === 'summary' && currentItem.userBriefId) {
    await supabase
      .from('user_briefs')
      .update({ audio_progress_seconds: progressSeconds })
      .eq('id', currentItem.userBriefId);
  } else if (currentItem.type === 'episode' && currentItem.savedEpisodeId) {
    await supabase
      .from('saved_episodes')
      .update({ audio_progress_seconds: progressSeconds })
      .eq('id', currentItem.savedEpisodeId);
  }
};

// Call every 10-15 seconds during playback
useEffect(() => {
  if (!isPlaying) return;
  
  const interval = setInterval(() => {
    syncProgressToDatabase();
  }, 15000);
  
  return () => clearInterval(interval);
}, [isPlaying, currentItem, position]);
```

---

### 🔴 Critical: No Auto-Complete on Playback End

**File:** `client/contexts/AudioPlayerContext.tsx`

**Problem:** Briefs/episodes are not marked as `is_completed: true` when playback finishes.

**Required: Add to playback completion handler**

```typescript
// When audio ends
const handlePlaybackEnd = async () => {
  if (!currentItem || !user) return;
  
  if (currentItem.type === 'summary' && currentItem.masterBriefId) {
    // Mark brief as completed
    await supabase
      .from('user_briefs')
      .update({ is_completed: true })
      .eq('master_brief_id', currentItem.masterBriefId)
      .eq('user_id', user.id);
    
    // Invalidate query cache
    queryClient.invalidateQueries({ queryKey: ['userBriefs'] });
  } else if (currentItem.type === 'episode' && currentItem.savedEpisodeId) {
    // Mark episode as completed
    await supabase
      .from('saved_episodes')
      .update({ is_completed: true })
      .eq('id', currentItem.savedEpisodeId);
    
    queryClient.invalidateQueries({ queryKey: ['savedEpisodes'] });
  }
};
```

---

### 🟡 Minor: Add Mobile Source to Analytics

**All analytics inserts should include `source: 'mobile'` in metadata:**

```typescript
await supabase.from('analytics_events').insert({
  user_id: user.id,
  event_type: 'summary_generated',
  brief_id: masterBriefId,
  language: profile?.preferred_language,
  metadata: {
    source: 'mobile',  // ← ADD THIS
    platform: Platform.OS,  // 'ios' or 'android'
    // ... other metadata
  },
});
```

---

### 🟡 Minor: Clean Up Replit Template Artifacts

**Remove or update these files that reference Express/Replit patterns:**

1. `client/lib/query-client.ts` - Uses Express-style fetch pattern, not needed with Supabase SDK
2. `shared/schema.ts` - Drizzle schema doesn't match Supabase schema

---

### Implementation Checklist

| Issue | Priority | Estimated Effort |
|-------|----------|------------------|
| Add audio engagement tracking | 🔴 Critical | 2-3 hours |
| Fix summary download URL | 🔴 Critical | 30 minutes |
| Add language filter to briefs query | 🔴 Critical | 15 minutes |
| Sync progress to database | 🔴 Critical | 1 hour |
| Auto-complete on playback end | 🔴 Critical | 30 minutes |
| Add mobile source to analytics | 🟡 Minor | 15 minutes |
| Clean up Replit artifacts | 🟡 Minor | 1 hour |

---

*Document generated for PodBrief Mobile App Development*
