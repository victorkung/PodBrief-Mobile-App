# PodBrief Mobile Integration Guide

> Best practices and patterns for building iOS/Android apps that integrate with PodBrief.

**Last Updated:** January 30, 2026

---

## Table of Contents

1. [Authentication Setup](#authentication-setup)
2. [Platform Detection](#platform-detection)
3. [Audio Playback Architecture](#audio-playback-architecture)
4. [Offline Download Strategy](#offline-download-strategy)
5. [Library Data Sync](#library-data-sync)
6. [Push Notifications (Future)](#push-notifications-future)
7. [Error Handling Patterns](#error-handling-patterns)

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

### Google OAuth

```typescript
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';

async function signInWithGoogle() {
  const redirectUrl = AuthSession.makeRedirectUri({
    scheme: 'podbrief',
    path: 'auth/callback',
  });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectUrl,
      skipBrowserRedirect: true,
    },
  });

  if (error) throw error;

  // Open browser for OAuth
  const result = await WebBrowser.openAuthSessionAsync(
    data.url!,
    redirectUrl
  );

  if (result.type === 'success') {
    // Extract tokens from URL and set session
    const url = new URL(result.url);
    const access_token = url.hash.match(/access_token=([^&]*)/)?.[1];
    const refresh_token = url.hash.match(/refresh_token=([^&]*)/)?.[1];
    
    if (access_token && refresh_token) {
      await supabase.auth.setSession({ access_token, refresh_token });
    }
  }
}
```

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

*Document generated for PodBrief Mobile App Development*
