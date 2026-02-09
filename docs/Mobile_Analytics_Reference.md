# PodBrief Mobile Reference

> **Single authoritative reference for the PodBrief iOS/Android mobile app.**  
> This document supersedes all previous mobile documentation (API Contract, Integration Guide, Migration Changelog, daily sync docs).

**Last Updated:** February 8, 2026  
**API Version:** 2.0

---

## Table of Contents

1. [Connection Details](#connection-details)
2. [Authentication](#authentication)
3. [Edge Function Catalog](#edge-function-catalog)
4. [Database Tables (Mobile-Relevant)](#database-tables-mobile-relevant)
5. [Analytics Event Tracking](#analytics-event-tracking)
6. [Audio Playback](#audio-playback)
7. [Language Support](#language-support)
8. [Pipeline Status Reference](#pipeline-status-reference)
9. [Push Notifications](#push-notifications)
10. [Error Logging](#error-logging)
11. [Marketing Sync (Loops.so)](#marketing-sync-loopsso)
12. [Deduplication Strategies](#deduplication-strategies)
13. [Integration Patterns](#integration-patterns)

---

## Connection Details

### Supabase Configuration

```typescript
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = 'https://wdylkaiyoelfcmphoaqs.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndkeWxrYWl5b2VsZmNtcGhvYXFzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY1MjcwMTQsImV4cCI6MjA4MjEwMzAxNH0.h9kbq-ABILY3ZrIZdWIimzJhdyGz-Cq1eztkEiCBKDk';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
```

### Base URLs

| Service | URL |
|---------|-----|
| Edge Functions | `https://wdylkaiyoelfcmphoaqs.supabase.co/functions/v1/` |
| REST API | `https://wdylkaiyoelfcmphoaqs.supabase.co/rest/v1/` |
| Auth | `https://wdylkaiyoelfcmphoaqs.supabase.co/auth/v1/` |
| Storage | `https://wdylkaiyoelfcmphoaqs.supabase.co/storage/v1/` |

### Headers for Authenticated Endpoints

```typescript
headers: {
  'Authorization': `Bearer ${accessToken}`,
  'apikey': SUPABASE_ANON_KEY,
  'Content-Type': 'application/json'
}
```

> The Supabase SDK handles headers automatically when using `supabase.functions.invoke()`.

---

## Authentication

### Email/Password

```typescript
// Sign Up
const { data, error } = await supabase.auth.signUp({
  email,
  password,
  options: {
    data: { first_name: firstName, preferred_language: 'en' },
    emailRedirectTo: 'podbrief://auth/callback',
  },
});

// Sign In
const { data, error } = await supabase.auth.signInWithPassword({ email, password });

// Sign Out
const { error } = await supabase.auth.signOut();
```

### Google OAuth (Browser-Based — Unified)

Mobile uses the same browser-based OAuth flow as web. This uses Lovable Cloud's managed OAuth — no separate iOS/Android client IDs needed.

```typescript
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';

WebBrowser.maybeCompleteAuthSession();

async function signInWithGoogle() {
  const redirectUri = makeRedirectUri({ scheme: 'podbrief', path: 'auth/callback' });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: redirectUri, skipBrowserRedirect: true },
  });

  if (error) throw error;

  const result = await WebBrowser.openAuthSessionAsync(data.url!, redirectUri);

  if (result.type === 'success') {
    const url = new URL(result.url);
    const params = new URLSearchParams(url.hash.slice(1));
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');

    if (accessToken && refreshToken) {
      await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    }
  }
}
```

### Session Management

```typescript
useEffect(() => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    setUser(session?.user ?? null);
    setSession(session);

    if (event === 'SIGNED_OUT') {
      clearLocalStorage();
    }
  });

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
const { data, error } = await supabase.auth.refreshSession();
if (error) {
  await supabase.auth.signOut();
}
```

---

## Edge Function Catalog

### Complete Function Reference

| Function | Auth | Category | Purpose |
|----------|------|----------|---------|
| `taddy-search` | No | Discovery | Search podcasts by keyword |
| `taddy-podcast-details` | No | Discovery | Get podcast info + paginated episodes |
| `taddy-latest-episodes` | Yes | Discovery | New episodes feed from followed shows |
| `get-episode-details` | No | Content | Single episode with description backfill |
| `get-show-discovery` | No | Content | Show page with brief count + latest briefs |
| `get-show-episodes` | No | Content | Paginated episodes for a show with brief status |
| `get-show-briefs` | No | Content | Paginated briefs for a show |
| `get-explore-shows` | No | Content | Popular shows sorted by brief_count |
| `generate-brief` | Yes | Briefs | Create AI brief (costs 1 credit) |
| `get-signed-audio-url` | Yes | Briefs | Signed URL for TTS audio (15-min expiry) |
| `get-public-brief-preview` | No | Briefs | Truncated preview of shared brief |
| `retry-taddy-transcript` | Yes | Briefs | Retry failed transcript + full pipeline |
| `regenerate-summary` | Yes | Briefs | Re-run AI summary for `summary_failed` briefs |
| `claim-brief` | Yes | Library | Add shared brief to library (free) |
| `claim-episode` | Yes | Library | Save episode to library |
| `ensure-episode-metadata` | No | Metadata | Register episode for SEO (fire-and-forget) |
| `ensure-podcast-metadata` | No | Metadata | Register podcast for SEO (fire-and-forget) |
| `create-checkout` | Yes | Billing | Start Stripe Pro subscription |
| `customer-portal` | Yes | Billing | Stripe billing portal URL |
| `cancel-subscription` | Yes | Billing | Cancel Pro subscription |
| `create-credit-refill` | Yes | Billing | One-time credit purchase |
| `delete-user` | Yes | User | Permanently delete account |
| `sync-to-loops` | No | Marketing | Loops.so engagement sync (fire-and-forget) |
| `log-error` | No | Utilities | Client error logging |
| `log-share-visit` | No | Utilities | Track share link visits |

---

### Podcast Discovery

#### `taddy-search`

```typescript
// Request
{ term: string; page?: number; limitPerPage?: number }

// Response
{ podcasts: Array<{ uuid, name, imageUrl, authorName, description, totalEpisodesCount }>; searchId: string }
```

- Filtered to exclude podcasts with ≤1 episode
- Max 10 results returned per search

#### `taddy-podcast-details`

```typescript
// Request
{ uuid: string; page?: number; limitPerPage?: number; searchTerm?: string }

// Response
{
  podcast: {
    uuid, name, imageUrl, authorName, description, totalEpisodesCount, rssUrl,
    episodes: Array<{ uuid, name, imageUrl, description, datePublished, duration, audioUrl, taddyTranscribeStatus }>
  }
}
```

- `datePublished` is Unix timestamp in milliseconds
- `duration` is in seconds

#### `taddy-latest-episodes`

```typescript
// Request (Auth Required)
{ uuids: string[]; page?: number; limitPerPage?: number }
// Recommended: limitPerPage: 50

// Response
{
  episodes: Array<{
    uuid, name, imageUrl, description, datePublished, duration, audioUrl, taddyTranscribeStatus,
    podcastSeries: { uuid, name, imageUrl }
  }>
}
```

---

### Content Discovery

#### `get-episode-details`

```typescript
// Request — provide either slug or taddyEpisodeUuid (slug takes precedence)
{ slug?: string; taddyEpisodeUuid?: string }

// Response
{
  episode: {
    id, slug, name, description, taddyEpisodeUuid, taddyPodcastUuid,
    podcastName, podcastSlug, imageUrl, podcastImageUrl, audioUrl,
    durationSeconds, publishedAt, briefSlug, createdAt
  }
}
```

- Auto-backfills description from Taddy if missing in database
- Returns 404 if episode not found — call `ensure-episode-metadata` first

#### `get-show-discovery`

```typescript
// Request
{ slug: string }

// Response
{
  show: { id, taddy_podcast_uuid, slug, name, description, image_url, author_name, total_episodes_count, brief_count },
  latestBriefs: Array<{ id, slug, episode_name, episode_thumbnail, created_at, audio_duration_seconds, language }>
}
```

#### `get-show-episodes`

```typescript
// Request
{ slug: string; page?: number; limitPerPage?: number }

// Response
{
  episodes: Array<{ uuid, name, imageUrl, description, datePublished, duration, audioUrl, slug, hasBrief }>,
  totalCount: number, hasMore: boolean,
  show: { name, imageUrl, taddy_podcast_uuid }
}
```

#### `get-show-briefs`

```typescript
// Request
{ slug: string; page?: number; limitPerPage?: number }

// Response
{
  briefs: Array<{ id, slug, episode_name, episode_thumbnail, episode_slug, created_at, audio_duration_seconds, language }>,
  totalCount: number, hasMore: boolean
}
```

#### `get-explore-shows`

```typescript
// Request
{ page?: number; limitPerPage?: number }

// Response
{
  shows: Array<{ id, taddy_podcast_uuid, slug, name, description, image_url, author_name, brief_count }>,
  hasMore: boolean
}
```

- Sorted by `brief_count` (most briefs first), only shows with ≥1 brief

---

### Brief Generation & Access

#### `generate-brief`

```typescript
// Request (Auth Required)
{
  episodeUuid: string;      // Taddy episode UUID (required)
  episodeName: string;      // Episode title (required)
  podcastName: string;      // Podcast name (required)
  podcastUuid: string;      // Taddy podcast UUID (required)
  episodeThumbnail?: string;
  episodeAudioUrl?: string;
  episodeDurationSeconds?: number;
  episodePublishedAt?: string;  // ISO date
  language?: string;            // ISO 639-1 (default: "en")
}

// Response (immediate — 202 Accepted)
{ success: true; masterBriefId: string; userBriefSlug: string; status: 'processing' | 'completed' }

// Response (already exists)
{ success: true; masterBriefId: string; userBriefSlug: string; status: 'completed'; existing: true }
```

- 1 credit deducted per new brief; no charge if brief already exists
- Processing continues in background (~60-120 seconds)
- Poll `user_briefs` or use realtime subscription to detect completion
- Language is read from `profiles.preferred_language` server-side — no need to pass explicitly

#### `get-signed-audio-url`

```typescript
// Request (Auth Required)
{ masterBriefId: string }

// Response
{ success: true; signedUrl: string }  // Expires in 15 minutes
```

#### `get-public-brief-preview`

```typescript
// Request
{ slug: string }

// Response
{
  brief: { episodeName, podcastName, episodeThumbnail, summaryPreview, audioDurationSeconds, episodeDurationSeconds, language },
  masterBriefId: string
}
```

#### `retry-taddy-transcript`

```typescript
// Request (Auth Required)
{ masterBriefId: string }

// Possible responses:
// 1. Transcript found — full pipeline runs in background
{ status: 'completed'; transcript: string }

// 2. Still processing (Taddy not ready)
{ status: 'processing' }

// 3. Already processing (deduplication guard)
{ status: 'already_processing'; message: string; currentStatus: string }
```

- **Deduplication guard:** Returns `already_processing` if `pipeline_status` is `transcribing`, `summarizing`, or `recording`
- After successful transcript, runs **full pipeline** in background (extraction → synthesis → audio → notifications)
- Includes Deepgram fallback if Taddy fails
- **Debounce the retry button** to prevent rapid duplicate calls

#### `regenerate-summary`

```typescript
// Request (Auth Required)
{ masterBriefId: string }

// Normal response
{ success: true }

// Missing transcript response
{ success: true; resetToFailed: true; message: string }
```

- When `resetToFailed: true`, switch UI to "Try Again" flow (calls `retry-taddy-transcript`)
- No additional credit charged

---

### Library Management

#### `claim-brief`

```typescript
// Request (Auth Required)
{ masterBriefId?: string; briefSlug?: string }  // Either one required

// Response
{ success: true; userBriefSlug: string; alreadyOwned: boolean }
```

- Brief marked as `is_gifted: true`, no credit deduction

#### `claim-episode`

```typescript
// Request (Auth Required)
{ episodeSlug: string }

// Response
{ success: true; alreadySaved: boolean }
```

---

### Metadata Registration (Fire-and-Forget)

#### `ensure-episode-metadata`

```typescript
// Request
{
  taddyEpisodeUuid: string; taddyPodcastUuid: string; name: string; podcastName: string;
  description?: string; podcastSlug?: string; imageUrl?: string; podcastImageUrl?: string;
  audioUrl?: string; durationSeconds?: number; publishedAt?: string;
}

// Response
{ slug: string; created: boolean }
```

#### `ensure-podcast-metadata`

```typescript
// Request
{ taddyPodcastUuid: string; name: string; description?: string; imageUrl?: string; authorName?: string; totalEpisodesCount?: number }

// Response
{ slug: string; created: boolean }
```

Both handle race conditions via Postgres error code `23505` (unique violation). Safe to call multiple times.

---

### User & Billing

#### `create-checkout`

```typescript
// Request (Auth Required) — no body
// Response
{ url: string }  // Redirect user to this Stripe Checkout URL
```

#### `customer-portal`

```typescript
// Request (Auth Required) — no body
// Response
{ url: string }  // Redirect to Stripe Portal
```

#### `cancel-subscription`

```typescript
// Request (Auth Required) — no body
// Response
{ success: true; cancelAt: string }  // ISO date when subscription ends
```

#### `create-credit-refill`

```typescript
// Request (Auth Required) — no body
// Response
{ url: string }  // Redirect to Stripe Checkout for credit pack
```

#### `delete-user`

```typescript
// Request (Auth Required) — no body
// Response
{ success: true; message: string }
```

- Deletes profile, all briefs, saved episodes, auth session

---

### Utility Functions

#### `log-error`

See [Error Logging](#error-logging) section.

#### `log-share-visit`

```typescript
// Request
{ referrerId: string; masterBriefId: string }  // Both must be valid UUIDs

// Response
{ success: true }
```

- Records `share_link_visited` event under the sharer's user ID
- Validates that `referrerId` owns the brief

---

## Database Tables (Mobile-Relevant)

### `profiles`

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | User ID (matches auth.users) |
| `email` | text | User email |
| `email_canonical` | text | Canonicalized email (dots removed for Gmail) |
| `first_name` | text | User's first name |
| `credits` | integer | Available brief credits (default: 5) |
| `plan` | text | `'free'` or `'pro'` |
| `pro_expires_at` | timestamptz | When Pro subscription ends |
| `subscription_cancel_at` | timestamptz | Scheduled cancellation date |
| `preferred_language` | text | ISO 639-1 code (default: `'en'`) |
| `expo_push_token` | text | Expo push notification token |
| `referred_by` | uuid | Referrer's user ID |
| `created_at` | timestamptz | Account creation |
| `updated_at` | timestamptz | Last profile update |

### `followed_podcasts`

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `user_id` | uuid | Owner |
| `taddy_podcast_uuid` | text | Taddy podcast identifier |
| `podcast_name` | text | Podcast title |
| `podcast_description` | text | Description |
| `podcast_image_url` | text | Cover image URL |
| `author_name` | text | Author/creator |
| `genres` | text[] | Genre tags |
| `total_episodes_count` | integer | Total episode count |

**Unique constraint:** `(user_id, taddy_podcast_uuid)`

### `saved_episodes`

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `user_id` | uuid | Owner |
| `taddy_episode_uuid` | text | Taddy episode identifier |
| `taddy_podcast_uuid` | text | Taddy podcast identifier |
| `episode_name` | text | Episode title |
| `podcast_name` | text | Podcast title |
| `episode_thumbnail` | text | Image URL |
| `episode_audio_url` | text | Direct audio URL |
| `episode_duration_seconds` | integer | Duration |
| `episode_published_at` | timestamptz | Publish date |
| `is_completed` | boolean | User finished listening (default: false) |
| `audio_progress_seconds` | integer | Playback position (default: 0) |

**Unique constraint:** `(user_id, taddy_episode_uuid)`  
**Note:** Does NOT contain `description` — use `get-episode-details` edge function for descriptions.

### `user_briefs`

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `user_id` | uuid | Owner |
| `master_brief_id` | uuid | FK to `master_briefs` |
| `slug` | text | URL-friendly brief slug |
| `is_completed` | boolean | User marked as completed |
| `audio_progress_seconds` | integer | Playback position |
| `is_hidden` | boolean | Soft-deleted by user |
| `is_gifted` | boolean | Received via share link |
| `preferred_language` | text | Language at time of creation |

**Unique constraint:** `(user_id, master_brief_id)`

### `master_briefs`

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `slug` | text | SEO-friendly URL slug |
| `language` | text | ISO 639-1 code |
| `summary_text` | text | Full markdown summary |
| `audio_url` | text | TTS audio path (in protected bucket) |
| `audio_duration_seconds` | integer | **Exact** duration from MP3 frame parsing |
| `pipeline_status` | text | See [Pipeline Status Reference](#pipeline-status-reference) |
| `taddy_episode_uuid` | text | Episode identifier |
| `taddy_podcast_uuid` | text | Podcast identifier |
| `podcast_name` | text | Podcast title |
| `episode_name` | text | Episode title |
| `episode_thumbnail` | text | Episode image URL |
| `episode_audio_url` | text | Original episode audio URL |
| `episode_duration_seconds` | integer | Original episode duration |
| `episode_published_at` | timestamptz | Episode publish date |
| `episode_slug` | text | Episode URL slug |
| `total_duration_minutes` | integer | Episode duration in minutes |
| `source` | text | Default: `'taddy'` |

**Unique constraint:** `(taddy_episode_uuid, language)`

### `brief_pipeline_state` (1:1 with `master_briefs`)

| Column | Type | Description |
|--------|------|-------------|
| `master_brief_id` | uuid | FK to `master_briefs` (unique) |
| `pipeline_status` | text | Mirror of `master_briefs.pipeline_status` |
| `pipeline_error` | text | Error message if failed |
| `summary_phase` | text | Current summary sub-phase |
| `audio_status` | text | `none`, `pending`, `processing`, `completed`, `failed` |
| `audio_error` | text | Audio generation error |

**Query pattern:**
```typescript
const { data } = await supabase
  .from('user_briefs')
  .select(`
    *,
    master_briefs!inner (
      id, summary_text, audio_url, audio_duration_seconds, pipeline_status,
      episode_name, podcast_name, episode_thumbnail, episode_audio_url,
      episode_duration_seconds, episode_published_at, slug, language,
      brief_pipeline_state (pipeline_error, summary_phase, audio_status, audio_error),
      brief_transcripts (transcript_content, ai_condensed_transcript)
    )
  `)
  .eq('is_hidden', false)
  .order('created_at', { ascending: false });
```

### `brief_transcripts` (1:1 with `master_briefs`)

| Column | Type | Description |
|--------|------|-------------|
| `master_brief_id` | uuid | FK to `master_briefs` (unique) |
| `transcript_content` | text | Full timestamped transcript |
| `ai_condensed_transcript` | text | AI-condensed research log |
| `transcript_source` | text | `'taddy'` or `'deepgram'` |

### `analytics_events`

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `user_id` | uuid | User who generated the event |
| `event_type` | text | Event name (see catalog below) |
| `brief_id` | uuid | Associated brief ID (**must be valid UUID**) |
| `language` | text | Language context |
| `metadata` | jsonb | Additional event data |
| `client_platform` | text | `'web'` or `'mobile'` (**NEW — required**) |
| `created_at` | timestamptz | Event timestamp |

### `audio_engagement_events`

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `user_id` | uuid | User who generated the event |
| `master_brief_id` | uuid | Associated brief ID (**must be valid UUID**) |
| `audio_type` | text | `'summary'` or `'full_episode'` |
| `event_type` | text | `'start'` or `'completion'` |
| `duration_seconds` | integer | Total audio duration |
| `progress_seconds` | integer | Current playback position |
| `progress_percentage` | numeric | Progress as percentage |
| `session_id` | text | Unique per play session (for deduplication) |
| `client_platform` | text | `'web'` or `'mobile'` (**NEW — required**) |
| `created_at` | timestamptz | Event timestamp |

---

## Analytics Event Tracking

### ⚠️ Critical: `client_platform` Field (Required)

All analytics inserts **must** include `client_platform: 'mobile'`. This is a dedicated database column (not metadata) that enables platform-level filtering in the admin dashboard. The web app sends `client_platform: 'web'`.

### ⚠️ Critical: UUID Sanitization

The `analytics_events.brief_id` and `audio_engagement_events.master_brief_id` columns are `uuid` type. If the mobile app uses the `episode-{uuid}` convention for full episode IDs, **strip the prefix before inserting**:

```typescript
/** Strip 'episode-' prefix so the value is a valid UUID for database storage */
function sanitizeBriefId(id: string): string {
  return id.replace(/^episode-/, '');
}
```

Failure to sanitize will cause **silent insert failures** — the database will reject the non-UUID value and no error will surface to the user.

### Event Catalog

| Event | Table | Trigger | Required Fields |
|-------|-------|---------|-----------------|
| `site_visit` | `analytics_events` | Once per app session (cold start) | `user_id`, `event_type`, `client_platform: 'mobile'` |
| `podcast_searched` | `analytics_events` | Debounced (5-min gap between logs) | `user_id`, `event_type`, `metadata: { term }`, `client_platform: 'mobile'` |
| `summary_generated` | `analytics_events` | After brief pipeline completes | `user_id`, `event_type`, `brief_id` (UUID), `language`, `client_platform: 'mobile'` |
| `audio_played` | `analytics_events` | First time a summary starts playing | `user_id`, `event_type`, `brief_id` (UUID), `client_platform: 'mobile'` |
| `full_episode_played` | `analytics_events` | First time a full episode starts playing | `user_id`, `event_type`, `brief_id` (taddy_episode_uuid, **no prefix**), `client_platform: 'mobile'` |
| `share_initiated` | `analytics_events` | When user opens/uses share sheet | `user_id`, `event_type`, `client_platform: 'mobile'` |

### Insert Examples

```typescript
// Site visit (once per cold start)
await supabase.from('analytics_events').insert({
  user_id: user.id,
  event_type: 'site_visit',
  client_platform: 'mobile',
});

// Search (debounced — 5-min gap)
await supabase.from('analytics_events').insert({
  user_id: user.id,
  event_type: 'podcast_searched',
  metadata: { term: searchQuery },
  client_platform: 'mobile',
});

// Summary generated
await supabase.from('analytics_events').insert({
  user_id: user.id,
  event_type: 'summary_generated',
  brief_id: masterBriefId,  // Must be valid UUID
  language: preferredLanguage,
  client_platform: 'mobile',
});

// Full episode played
await supabase.from('analytics_events').insert({
  user_id: user.id,
  event_type: 'full_episode_played',
  brief_id: taddyEpisodeUuid,  // Raw UUID — NO 'episode-' prefix
  client_platform: 'mobile',
});
```

### Engagement Tracking (Audio)

Engagement events track meaningful listening behavior. They are inserted into `audio_engagement_events`.

#### Rules

1. **Start event:** Fire after **30 seconds of accumulated listening time**
   - Track elapsed time while audio is actually playing
   - Exclude seeks (only count forward progress deltas < 2 seconds)
   - This means: if user plays 10s, seeks to 50s, plays 20s — accumulated = 30s → fire start

2. **Completion event:** Fire when playback position reaches **75%**

3. **Session ID:** Generate a unique ID per track play session: `${Date.now()}-${Math.random().toString(36).slice(2)}`

4. **Deduplication:** Before inserting a `start` event, check if one already exists for this user + brief + audio_type:
   ```typescript
   const { data: existing } = await supabase
     .from('audio_engagement_events')
     .select('id')
     .eq('user_id', user.id)
     .eq('master_brief_id', cleanId)
     .eq('audio_type', audioType)
     .eq('event_type', 'start')
     .maybeSingle();

   if (existing) return; // Already logged
   ```

5. **`audio_type`:** Must be `'summary'` or `'full_episode'`

6. **`client_platform`:** Must be `'mobile'`

#### Insert Examples

```typescript
const sessionId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

// Start event (after 30s accumulated listening)
await supabase.from('audio_engagement_events').insert({
  user_id: user.id,
  master_brief_id: sanitizeBriefId(masterBriefId),  // Strip 'episode-' prefix
  audio_type: 'summary',  // or 'full_episode'
  event_type: 'start',
  duration_seconds: Math.round(totalDuration),
  progress_seconds: Math.round(currentPosition),
  progress_percentage: Math.round((currentPosition / totalDuration) * 10000) / 100,
  session_id: sessionId,
  client_platform: 'mobile',
});

// Completion event (at 75% position)
await supabase.from('audio_engagement_events').insert({
  user_id: user.id,
  master_brief_id: sanitizeBriefId(masterBriefId),
  audio_type: 'summary',
  event_type: 'completion',
  duration_seconds: Math.round(totalDuration),
  progress_seconds: Math.round(currentPosition),
  progress_percentage: Math.round((currentPosition / totalDuration) * 10000) / 100,
  session_id: sessionId,
  client_platform: 'mobile',
});
```

### What NOT to Track from Mobile

- **`share_link_visited`** — Logged server-side by `log-share-visit` edge function
- **`summary_generated` from polling** — The admin dashboard uses `user_briefs` counts for accuracy; analytics events are best-effort

---

## Audio Playback

### Two Audio Types

| Type | Source | Access Method | Storage |
|------|--------|---------------|---------|
| **Summary (TTS)** | AI-generated narration | Signed URL via `get-signed-audio-url` | Protected bucket |
| **Full Episode** | Original podcast audio | Direct URL from Taddy | External CDN |

### Playing Summary Audio

```typescript
// 1. Get signed URL (valid 15 minutes)
const { data } = await supabase.functions.invoke('get-signed-audio-url', {
  body: { masterBriefId },
});
const signedUrl = data.signedUrl;

// 2. Refresh URL before expiry (1 minute buffer)
// Track urlExpiresAt = now + 15 minutes
// On each play action, check if URL needs refreshing
```

### Playing Full Episodes

```typescript
// Direct URL — no signing needed
const audioUrl = episode.audioUrl || savedEpisode.episode_audio_url;
audioPlayer.play(audioUrl);
```

### Progress Persistence

```typescript
// For summaries — update user_briefs
await supabase.from('user_briefs')
  .update({ audio_progress_seconds: progressSeconds })
  .eq('id', userBriefId);

// For full episodes — update saved_episodes
await supabase.from('saved_episodes')
  .update({
    audio_progress_seconds: progressSeconds,
    is_completed: progressSeconds / totalDuration >= 0.75,
  })
  .eq('id', savedEpisodeId);
```

### Playback Speed

Supported speeds: `0.75x, 0.8x, 0.85x, 0.9x, 0.95x, 1x, 1.05x, 1.1x, 1.15x, 1.2x, 1.25x`

Persist preference locally via `AsyncStorage`.

---

## Language Support

### Supported Languages

| Code | Label |
|------|-------|
| `en` | English |
| `es` | Español |
| `fr` | Français |
| `de` | Deutsch |
| `pt` | Português |
| `zh` | Mandarin Chinese |
| `ja` | 日本語 |
| `ko` | 한국어 |
| `hi` | हिन्दी |
| `ar` | العربية |

### Language-Aware Brief Checking

When checking if a user has a brief for an episode, **filter by language**:

```typescript
const { data } = await supabase
  .from('user_briefs')
  .select('id, master_briefs!inner(taddy_episode_uuid, language)')
  .eq('user_id', user.id)
  .eq('is_hidden', false)
  .eq('master_briefs.taddy_episode_uuid', episodeUuid)
  .eq('master_briefs.language', profile.preferred_language)
  .maybeSingle();

const hasBrief = !!data;
```

Re-evaluate when the user changes language in Settings.

### CJK-Aware Word Counting

If calculating word counts or reading times client-side, use CJK-aware logic:

```typescript
function countWords(text: string): number {
  if (!text || !text.trim()) return 0;
  const whitespaceWords = text.trim().split(/\s+/).filter(w => w.length > 0).length;
  const cjkPattern = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/g;
  const cjkChars = (text.match(cjkPattern) || []).length;
  return cjkChars > whitespaceWords ? cjkChars : whitespaceWords;
}
```

### Non-English Brief Slugs

Non-English briefs use language suffix slugs: `{base-slug}-{lang}` (e.g., `episode-name-es`, `episode-name-zh`). English briefs keep the existing random suffix pattern.

---

## Pipeline Status Reference

| Status | Meaning | User Recovery |
|--------|---------|---------------|
| `pending` | Brief created, waiting to start | Show loading UI |
| `transcribing` | Fetching transcript from Taddy/Deepgram | Show "Generating..." |
| `summarizing` | AI extraction + synthesis in progress | Show "Generating..." |
| `recording` | Audio generation in progress | Show "Generating..." |
| `completed` | Brief fully ready (summary + audio) | Brief ready to view/listen |
| `failed` | Transcript or pipeline error | Show "Try Again" → calls `retry-taddy-transcript` |
| `summary_failed` | AI quality check failed | Show "Regenerate Summary" → calls `regenerate-summary` |

### Recovery Flows

**For `failed` status:**
```typescript
const { data } = await supabase.functions.invoke('retry-taddy-transcript', {
  body: { masterBriefId },
});

if (data?.status === 'already_processing') {
  showToast('Brief is already being processed');
} else if (data?.status === 'processing') {
  showToast('Transcript is being processed. Check back in a minute.');
}
// If status === 'completed', pipeline runs automatically in background
```

**For `summary_failed` status:**
```typescript
const { data } = await supabase.functions.invoke('regenerate-summary', {
  body: { masterBriefId },
});

if (data?.resetToFailed) {
  // Transcript was missing — brief reset to 'failed'
  // Switch UI to "Try Again" flow
}
```

### Pipeline Completion Ownership

`generate-audio` is the **sole authority** for:
1. Setting `pipeline_status: 'completed'` (after audio upload)
2. Setting `pipeline_status: 'failed'` (if audio generation fails)
3. Sending email notifications
4. Sending push notifications

Neither `retry-taddy-transcript` nor `regenerate-summary` set `completed` or send notifications — they delegate to `generate-audio`.

### Transcription Fallback

If Taddy fails after 2 attempts, **Deepgram Nova-2** is used as fallback:
- `transcript_source` column will be `'deepgram'` instead of `'taddy'`
- Transparent to the client — same transcript format
- Partial acceptance: transcripts with ≥50% expected characters are accepted

---

## Push Notifications

### Token Registration

```typescript
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

async function registerForPushNotifications() {
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return;

  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId: Constants.expoConfig?.extra?.eas?.projectId,
  });

  await supabase.from('profiles')
    .update({ expo_push_token: tokenData.data })
    .eq('id', user.id);
}
```

### Notification Payloads

**Success:**
```json
{
  "title": "Your summary is ready! 🎧",
  "body": "Episode Name - Podcast Name",
  "data": { "masterBriefId": "uuid" }
}
```

**Failure:**
```json
{
  "title": "Summary generation failed",
  "body": "We couldn't generate a summary for Episode Name. Tap to retry.",
  "data": { "masterBriefId": "uuid" }
}
```

### Deep Linking

On notification tap, navigate to the brief detail screen using `masterBriefId` from the payload data. The brief will have:
- `pipeline_status: 'completed'` (success notification) → show brief
- `pipeline_status: 'failed'` or `'summary_failed'` (failure notification) → show recovery action

```typescript
const lastNotificationResponse = Notifications.useLastNotificationResponse();

useEffect(() => {
  if (lastNotificationResponse) {
    const { masterBriefId } = lastNotificationResponse.notification.request.content.data;
    if (masterBriefId) {
      navigation.navigate('BriefDetail', { masterBriefId });
    }
  }
}, [lastNotificationResponse]);
```

### Backend Details

Notifications are sent via the Replit proxy endpoint:
```
POST https://pod-brief-mobile-app.replit.app/api/send-notification
Header: X-API-Key: ${REPLIT_PUSH_API_KEY}
```

Triggered from: `generate-brief`, `generate-audio`, `regenerate-summary`, `retry-taddy-transcript`

---

## Error Logging

### `log-error` Edge Function

```typescript
await supabase.functions.invoke('log-error', {
  body: {
    error_code: 'SOME_ERROR',                    // Machine-readable code (optional)
    error_message: 'Description of what failed',  // Required
    error_source: 'edge_function',                // Required: 'gemini' | 'stripe' | 'edge_function' | 'auth' | 'taddy' | 'unknown'
    url: '/screen-or-route-where-error-occurred', // Required
    client_platform: 'mobile',                    // Required
    metadata: {
      platform: Platform.OS,
      version: DeviceInfo.getVersion(),
    },
  },
}).catch(() => {}); // Silent fail
```

**Important:**
- User ID is extracted from JWT — don't pass it in the body
- Only log **service-level errors** that affect user experience
- Do NOT log expected business logic (e.g., `NO_CREDITS`) or user input errors

---

## Marketing Sync (Loops.so)

### Trigger Points

| Trigger | Action | Key Payload |
|---------|--------|-------------|
| User signs up | `signup` | email, firstName, userId, preferredLanguage, credits (5) |
| Pro subscription starts | `upgraded` | email, userId, firstName |
| Subscription cancelled | `downgraded` | email, userId, firstName |
| Follow/unfollow a show | `engagement_update` | email, showsFollowed (from DB) |
| Generate brief | `engagement_update` | email, briefsGenerated, lastBriefDate |

### Getting Accurate Counts

Always fetch from the database — don't track locally:

```typescript
const { data } = await supabase.rpc('get_user_engagement', { p_user_id: userId });
// Returns: { shows_followed, briefs_generated, last_brief_date }
```

### Example: After Following a Podcast

```typescript
// 1. PRIMARY: Insert into followed_podcasts
await supabase.from('followed_podcasts').insert({ ... });

// 2. FIRE-AND-FORGET: Register metadata
supabase.functions.invoke('ensure-podcast-metadata', {
  body: { taddyPodcastUuid, name, ... }
}).catch(console.error);

// 3. FIRE-AND-FORGET: Sync engagement
const { data } = await supabase.rpc('get_user_engagement', { p_user_id: userId });
supabase.functions.invoke('sync-to-loops', {
  body: { action: 'engagement_update', email: user.email, showsFollowed: data.shows_followed },
}).catch(console.error);
```

---

## Deduplication Strategies

### Database Level

| Table | Unique Constraint | Purpose |
|-------|-------------------|---------|
| `saved_episodes` | `(user_id, taddy_episode_uuid)` | One save per user per episode |
| `followed_podcasts` | `(user_id, taddy_podcast_uuid)` | One follow per user per podcast |
| `episode_metadata` | `taddy_episode_uuid` | Global episode registry |
| `podcast_metadata` | `taddy_podcast_uuid` | Global podcast registry |
| `user_briefs` | `(user_id, master_brief_id)` | One brief per user per master |
| `master_briefs` | `(taddy_episode_uuid, language)` | One master per episode per language |

### Client Level

Check existing state before showing "Add" or "Follow" buttons. Handle Postgres error `23505` (unique violation) as success — it means the record already exists.

```typescript
const { error } = await supabase.from('saved_episodes').insert({ ... });
if (error?.code === '23505') {
  // Already saved — treat as success
  return { alreadySaved: true };
}
```

### Edge Function Level

All `ensure-*` functions handle race conditions internally via Postgres error `23505`.

---

## Integration Patterns

### Fire-and-Forget

Non-critical operations (metadata registration, marketing sync) should be fire-and-forget:

```typescript
// Primary operation must succeed
const { error } = await supabase.from('saved_episodes').insert({ ... });
if (error) throw error;

// Secondary operations — don't block on these
supabase.functions.invoke('ensure-episode-metadata', { body: { ... } }).catch(console.error);
showToast('Episode saved');
```

### When to Call Metadata Functions

| User Action | Edge Function | Purpose |
|-------------|---------------|---------|
| Save episode | `ensure-episode-metadata` | Enable public sharing URLs |
| Follow podcast | `ensure-podcast-metadata` | Enable public show pages |
| Download episode | `ensure-episode-metadata` | Ensure slug exists for offline item |
| Generate brief | None needed | `generate-brief` handles metadata |
| Claim shared brief | None needed | Brief already has metadata |

### Screen-Specific Data Sources

| Screen | Primary Source | Edge Function |
|--------|---------------|---------------|
| Episode Details | `episode_metadata` | `get-episode-details` (required for descriptions) |
| Brief Details | `master_briefs` via `user_briefs` JOIN | Direct DB query |
| Show/Podcast Page | `podcast_metadata` | `get-show-discovery` |
| Episode List (Show) | Taddy API | `get-show-episodes` |
| Explore | Aggregated | `get-explore-shows` |
| Library (Briefs) | `user_briefs` + `master_briefs` | Direct DB query |
| Library (Episodes) | `saved_episodes` | Direct DB query |

### Error Handling Pattern

```typescript
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3, delayMs = 1000): Promise<T> {
  let lastError: Error;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (error.message?.includes('401') || error.message?.includes('403')) throw error;
      if (i < maxRetries - 1) await new Promise(r => setTimeout(r, delayMs * Math.pow(2, i)));
    }
  }
  throw lastError!;
}
```

### HTTP Error Codes

| Code | Meaning | Action |
|------|---------|--------|
| 400 | Bad Request | Check request body |
| 401 | Unauthorized | Refresh auth token |
| 403 | Forbidden | User lacks permission |
| 404 | Not Found | Resource doesn't exist |
| 429 | Rate Limited | Exponential backoff |
| 500 | Server Error | Retry with backoff |

---

*Last updated: February 8, 2026 — PodBrief Mobile Reference v2.0*
