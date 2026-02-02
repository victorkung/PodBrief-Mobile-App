# PodBrief Mobile API Contract

> Complete API reference for building iOS/Android apps that connect to the PodBrief backend.

**Last Updated:** February 2, 2026  
**API Version:** 1.2

> ⚠️ **IMPORTANT:** A code audit was performed on Feb 2, 2026. See [Mobile Audit Findings](./Mobile_Integration_Guide.md#mobile-audit-findings--required-fixes) for critical implementation gaps that need to be fixed.

---

## Table of Contents

1. [Connection Details](#connection-details)
2. [Authentication](#authentication)
3. [Edge Function Reference](#edge-function-reference)
   - [Podcast Discovery](#podcast-discovery)
   - [Content Discovery](#content-discovery)
   - [Brief Generation & Access](#brief-generation--access)
   - [Library Management](#library-management)
   - [Metadata Registration](#metadata-registration)
   - [User & Billing](#user--billing)
   - [Marketing & Analytics](#marketing--analytics)
   - [Utility Functions](#utility-functions)
4. [Error Handling](#error-handling)
5. [Rate Limits](#rate-limits)

---

## Connection Details

### Supabase Configuration

```typescript
const SUPABASE_URL = 'https://wdylkaiyoelfcmphoaqs.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndkeWxrYWl5b2VsZmNtcGhvYXFzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY1MjcwMTQsImV4cCI6MjA4MjEwMzAxNH0.h9kbq-ABILY3ZrIZdWIimzJhdyGz-Cq1eztkEiCBKDk';
```

### Base URLs

| Environment | URL |
|-------------|-----|
| Edge Functions | `https://wdylkaiyoelfcmphoaqs.supabase.co/functions/v1/` |
| REST API | `https://wdylkaiyoelfcmphoaqs.supabase.co/rest/v1/` |
| Auth | `https://wdylkaiyoelfcmphoaqs.supabase.co/auth/v1/` |
| Storage | `https://wdylkaiyoelfcmphoaqs.supabase.co/storage/v1/` |

---

## Authentication

### Headers Required for Authenticated Endpoints

```typescript
headers: {
  'Authorization': `Bearer ${accessToken}`,
  'apikey': SUPABASE_ANON_KEY,
  'Content-Type': 'application/json'
}
```

### Using Supabase SDK (Recommended)

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Sign in
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password123'
});

// Access token is automatically managed
// Call Edge Functions with auth
const { data, error } = await supabase.functions.invoke('function-name', {
  body: { /* request body */ }
});
```

### Mobile Google Sign-In (Unified Browser OAuth)

Mobile apps use the same browser-based Google OAuth as web. This uses Lovable Cloud's managed OAuth - no separate iOS/Android client IDs needed.

```typescript
// Expo example
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';

WebBrowser.maybeCompleteAuthSession();

const signIn = async () => {
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
};
```

---

## Edge Function Reference

### Podcast Discovery

#### `taddy-search` - Search Podcasts

Search the podcast catalog by keyword.

| Property | Value |
|----------|-------|
| **Endpoint** | `POST /functions/v1/taddy-search` |
| **Auth Required** | No (but recommended) |

**Request Body:**
```typescript
interface TaddySearchRequest {
  term: string;           // Search query (required, min 1 char)
  page?: number;          // Page number (default: 1)
  limitPerPage?: number;  // Results per page (default: 20, max: 50)
}
```

**Response:**
```typescript
interface TaddySearchResponse {
  podcasts: Array<{
    uuid: string;
    name: string;
    imageUrl: string | null;
    authorName: string | null;
    description: string | null;
    totalEpisodesCount: number;
  }>;
  searchId: string;
}
```

**Example:**
```typescript
const { data, error } = await supabase.functions.invoke('taddy-search', {
  body: { term: 'technology', page: 1, limitPerPage: 20 }
});
```

**Notes:**
- Results are filtered to exclude podcasts with ≤1 episode
- Results sorted by episode count (most episodes first)
- Maximum 10 results returned per search

---

#### `taddy-podcast-details` - Get Podcast & Episodes

Fetch podcast details with paginated episodes.

| Property | Value |
|----------|-------|
| **Endpoint** | `POST /functions/v1/taddy-podcast-details` |
| **Auth Required** | No (but recommended) |

**Request Body:**
```typescript
interface TaddyPodcastDetailsRequest {
  uuid: string;           // Taddy podcast UUID (required)
  page?: number;          // Episode page (default: 1)
  limitPerPage?: number;  // Episodes per page (default: 10)
  searchTerm?: string;    // Filter episodes by keyword
}
```

**Response:**
```typescript
interface TaddyPodcastDetailsResponse {
  podcast: {
    uuid: string;
    name: string;
    imageUrl: string | null;
    authorName: string | null;
    description: string | null;
    totalEpisodesCount: number;
    rssUrl: string | null;
    episodes: Array<{
      uuid: string;
      name: string;
      imageUrl: string | null;
      description: string | null;
      datePublished: number;      // Unix timestamp in milliseconds
      duration: number;           // Duration in seconds
      audioUrl: string;
      taddyTranscribeStatus: string; // "COMPLETED", "NOT_TRANSCRIBING", etc.
    }>;
  };
}
```

**Notes:**
- When `searchTerm` is provided, sort order changes to "SEARCH" (relevance)
- Otherwise, episodes are sorted by "LATEST" (most recent first)

---

#### `taddy-latest-episodes` - New Episodes Feed

Get latest episodes from followed podcasts.

| Property | Value |
|----------|-------|
| **Endpoint** | `POST /functions/v1/taddy-latest-episodes` |
| **Auth Required** | Yes |

**Request Body:**
```typescript
interface TaddyLatestEpisodesRequest {
  uuids: string[];        // Array of podcast UUIDs to fetch (required)
  page?: number;          // Page number (default: 1)
  limitPerPage?: number;  // Episodes per page (default: 30, max: 50)
}
```

**Response:**
```typescript
interface TaddyLatestEpisodesResponse {
  episodes: Array<{
    uuid: string;
    name: string;
    imageUrl: string | null;
    description: string | null;
    datePublished: number;
    duration: number;
    audioUrl: string;
    taddyTranscribeStatus: string;
    podcastSeries: {
      uuid: string;
      name: string;
      imageUrl: string | null;
    };
  }>;
}
```

---

### Content Discovery

#### `get-episode-details` - Get Single Episode

Fetch detailed information for a single episode, including description backfill from Taddy if missing.

| Property | Value |
|----------|-------|
| **Endpoint** | `POST /functions/v1/get-episode-details` |
| **Auth Required** | No |

**Request Body:**
```typescript
interface GetEpisodeDetailsRequest {
  slug: string;  // Episode slug from episode_metadata (required)
}
```

**Response:**
```typescript
interface GetEpisodeDetailsResponse {
  episode: {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    taddy_episode_uuid: string;
    taddy_podcast_uuid: string;
    podcast_name: string;
    podcast_slug: string | null;
    image_url: string | null;
    podcast_image_url: string | null;
    audio_url: string | null;
    duration_seconds: number | null;
    published_at: string | null;
    master_brief_id: string | null;
  };
}
```

**Notes:**
- If `description` is null in database, function fetches from Taddy API and backfills
- Used for dedicated episode pages (SEO landing pages)

---

#### `get-show-discovery` - Show Page Data

Get podcast details with brief count and latest briefs for show pages.

| Property | Value |
|----------|-------|
| **Endpoint** | `POST /functions/v1/get-show-discovery` |
| **Auth Required** | No |

**Request Body:**
```typescript
interface GetShowDiscoveryRequest {
  slug: string;  // Podcast slug from podcast_metadata (required)
}
```

**Response:**
```typescript
interface GetShowDiscoveryResponse {
  show: {
    id: string;
    taddy_podcast_uuid: string;
    slug: string;
    name: string;
    description: string | null;
    image_url: string | null;
    author_name: string | null;
    total_episodes_count: number | null;
    brief_count: number;  // Number of briefs generated for this show
  };
  latestBriefs: Array<{
    id: string;
    slug: string;
    episode_name: string;
    episode_thumbnail: string | null;
    created_at: string;
    audio_duration_seconds: number | null;
    language: string;
  }>;
}
```

**Notes:**
- `brief_count` is calculated from `master_briefs` table
- `latestBriefs` returns up to 6 most recent briefs
- Function includes fallback logic to find shows from `master_briefs` if not in `podcast_metadata`

---

#### `get-show-episodes` - Paginated Episodes for Show

Get paginated episodes for a specific show with brief status.

| Property | Value |
|----------|-------|
| **Endpoint** | `POST /functions/v1/get-show-episodes` |
| **Auth Required** | No |

**Request Body:**
```typescript
interface GetShowEpisodesRequest {
  slug: string;           // Podcast slug (required)
  page?: number;          // Page number (default: 1)
  limitPerPage?: number;  // Results per page (default: 20)
}
```

**Response:**
```typescript
interface GetShowEpisodesResponse {
  episodes: Array<{
    uuid: string;
    name: string;
    imageUrl: string | null;
    description: string | null;
    datePublished: number;
    duration: number;
    audioUrl: string;
    slug: string | null;         // Episode slug if metadata exists
    hasBrief: boolean;           // Whether a brief exists for this episode
  }>;
  totalCount: number;
  hasMore: boolean;
  show: {
    name: string;
    imageUrl: string | null;
    taddy_podcast_uuid: string;
  };
}
```

---

#### `get-show-briefs` - Paginated Briefs for Show

Get paginated briefs generated for a specific show.

| Property | Value |
|----------|-------|
| **Endpoint** | `POST /functions/v1/get-show-briefs` |
| **Auth Required** | No |

**Request Body:**
```typescript
interface GetShowBriefsRequest {
  slug: string;           // Podcast slug (required)
  page?: number;          // Page number (default: 1)
  limitPerPage?: number;  // Results per page (default: 20)
}
```

**Response:**
```typescript
interface GetShowBriefsResponse {
  briefs: Array<{
    id: string;
    slug: string;
    episode_name: string;
    episode_thumbnail: string | null;
    episode_slug: string | null;
    created_at: string;
    audio_duration_seconds: number | null;
    language: string;
  }>;
  totalCount: number;
  hasMore: boolean;
}
```

---

#### `get-explore-shows` - Featured/Popular Shows

Get featured shows for the explore/discovery page, sorted by popularity.

| Property | Value |
|----------|-------|
| **Endpoint** | `POST /functions/v1/get-explore-shows` |
| **Auth Required** | No |

**Request Body:**
```typescript
interface GetExploreShowsRequest {
  page?: number;          // Page number (default: 1)
  limitPerPage?: number;  // Results per page (default: 20)
}
```

**Response:**
```typescript
interface GetExploreShowsResponse {
  shows: Array<{
    id: string;
    taddy_podcast_uuid: string;
    slug: string;
    name: string;
    description: string | null;
    image_url: string | null;
    author_name: string | null;
    brief_count: number;  // Popularity metric
  }>;
  hasMore: boolean;
}
```

**Notes:**
- Shows are sorted by `brief_count` (most briefs first)
- Only shows with at least 1 brief are included
- Includes fallback logic to create missing `podcast_metadata` entries

---

### Brief Generation & Access

#### `generate-taddy-brief` - Generate AI Brief

Generate an AI-powered summary of a podcast episode. **This is the primary brief creation endpoint.**

| Property | Value |
|----------|-------|
| **Endpoint** | `POST /functions/v1/generate-taddy-brief` |
| **Auth Required** | Yes |

**Request Body:**
```typescript
interface GenerateTaddyBriefRequest {
  episodeUuid: string;     // Taddy episode UUID (required)
  episodeName: string;     // Episode title (required)
  podcastName: string;     // Podcast name (required)
  podcastUuid: string;     // Taddy podcast UUID (required)
  episodeThumbnail?: string;
  episodeAudioUrl?: string;
  episodeDurationSeconds?: number;
  episodePublishedAt?: string; // ISO date string
  language?: string;       // ISO 639-1 code (default: "en")
  skipDuplicateCheck?: boolean; // For admin use
}
```

**Response (Immediate - 202 Accepted):**
```typescript
interface GenerateBriefResponse {
  success: true;
  message: string;
  masterBriefId: string;
  userBriefSlug: string;  // URL-friendly slug for the user's brief
  status: 'processing' | 'completed';
}
```

**Response (Already Exists):**
```typescript
interface ExistingBriefResponse {
  success: true;
  message: string;
  masterBriefId: string;
  userBriefSlug: string;
  status: 'completed';
  existing: true;
}
```

**Credit Consumption:**
- 1 credit deducted per new brief generation
- No credit deducted if user already owns the brief
- Pro users have unlimited credits

**Processing Flow:**
1. Function returns immediately with `status: 'processing'`
2. Brief generation continues in background (~60-120 seconds)
3. Poll `user_briefs` table or use realtime subscription to detect completion

---

#### `get-signed-audio-url` - Get Audio Playback URL

Get a signed URL for playing TTS summary audio.

| Property | Value |
|----------|-------|
| **Endpoint** | `POST /functions/v1/get-signed-audio-url` |
| **Auth Required** | Yes |

**Request Body:**
```typescript
interface GetSignedAudioUrlRequest {
  masterBriefId: string;  // UUID of the master brief (required)
}
```

**Response:**
```typescript
interface GetSignedAudioUrlResponse {
  success: true;
  signedUrl: string;  // Expires in 15 minutes
}
```

**Notes:**
- User must own the brief (via `user_briefs`) or be an admin
- URL is valid for 15 minutes - refresh before expiry
- Audio is MP3 format

---

#### `get-public-brief-preview` - Get Public Brief Teaser

Get a truncated preview of a shared brief (for unauthenticated users).

| Property | Value |
|----------|-------|
| **Endpoint** | `POST /functions/v1/get-public-brief-preview` |
| **Auth Required** | No |

**Request Body:**
```typescript
interface GetPublicBriefPreviewRequest {
  slug: string;  // Brief slug from share URL (required)
}
```

**Response:**
```typescript
interface GetPublicBriefPreviewResponse {
  brief: {
    episodeName: string;
    podcastName: string;
    episodeThumbnail: string | null;
    summaryPreview: string;  // ~150 characters of summary
    audioDurationSeconds: number | null;
    episodeDurationSeconds: number | null;
    language: string;
  };
  masterBriefId: string;
}
```

---

### Library Management

#### `claim-brief` - Add Shared Brief to Library

Add a publicly shared brief to user's library (no credit charge).

| Property | Value |
|----------|-------|
| **Endpoint** | `POST /functions/v1/claim-brief` |
| **Auth Required** | Yes |

**Request Body:**
```typescript
interface ClaimBriefRequest {
  masterBriefId?: string;  // Either masterBriefId or briefSlug required
  briefSlug?: string;
}
```

**Response:**
```typescript
interface ClaimBriefResponse {
  success: true;
  userBriefSlug: string;
  alreadyOwned: boolean;  // True if user already had this brief
}
```

**Notes:**
- Brief is marked as `is_gifted: true`
- No credit deduction
- If user already owns (hidden), it will be unhidden

---

#### `claim-episode` - Save Episode to Library

Save a full episode to user's library for later listening.

| Property | Value |
|----------|-------|
| **Endpoint** | `POST /functions/v1/claim-episode` |
| **Auth Required** | Yes |

**Request Body:**
```typescript
interface ClaimEpisodeRequest {
  episodeSlug: string;  // Episode slug from episode_metadata (required)
}
```

**Response:**
```typescript
interface ClaimEpisodeResponse {
  success: true;
  alreadySaved: boolean;
}
```

**Notes:**
- No credit charge for saving episodes
- Creates entry in `saved_episodes` table
- Requires episode to exist in `episode_metadata`

---

### Metadata Registration

These functions create public SEO-friendly records for episodes and podcasts. They should be called using the **fire-and-forget pattern** (see Integration Guide).

#### `ensure-episode-metadata` - Register Episode for Public URLs

Creates or retrieves the public SEO-friendly slug for an episode. Called after saving an episode to enable sharing.

| Property | Value |
|----------|-------|
| **Endpoint** | `POST /functions/v1/ensure-episode-metadata` |
| **Auth Required** | No |

**Request Body:**
```typescript
interface EnsureEpisodeMetadataRequest {
  taddyEpisodeUuid: string;   // Taddy episode UUID (required)
  taddyPodcastUuid: string;   // Taddy podcast UUID (required)
  name: string;               // Episode title (required)
  podcastName: string;        // Podcast name (required)
  description?: string;       // Episode description
  podcastSlug?: string;       // Associated podcast's slug (if known)
  imageUrl?: string;          // Episode image URL
  podcastImageUrl?: string;   // Podcast image URL (fallback)
  audioUrl?: string;          // Episode audio URL
  durationSeconds?: number;   // Episode duration
  publishedAt?: string;       // ISO date string
}
```

**Response:**
```typescript
interface EnsureEpisodeMetadataResponse {
  slug: string;      // SEO-friendly URL slug (e.g., "episode-title-name")
  created: boolean;  // true if new, false if existing record returned
}
```

**Deduplication:**
- Function checks `taddy_episode_uuid` and returns existing slug if found
- Race conditions handled via Postgres error code `23505` (unique violation)
- Safe to call multiple times for the same episode

**Example:**
```typescript
// Fire-and-forget after saving episode
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
```

---

#### `ensure-podcast-metadata` - Register Podcast for Public URLs

Creates or retrieves the public SEO-friendly slug for a podcast. Called after following a show to enable sharing.

| Property | Value |
|----------|-------|
| **Endpoint** | `POST /functions/v1/ensure-podcast-metadata` |
| **Auth Required** | No |

**Request Body:**
```typescript
interface EnsurePodcastMetadataRequest {
  taddyPodcastUuid: string;    // Taddy podcast UUID (required)
  name: string;                // Podcast name (required)
  description?: string;        // Podcast description
  imageUrl?: string;           // Podcast cover image URL
  authorName?: string;         // Podcast author/creator name
  totalEpisodesCount?: number; // Total number of episodes
}
```

**Response:**
```typescript
interface EnsurePodcastMetadataResponse {
  slug: string;      // SEO-friendly URL slug (e.g., "podcast-name")
  created: boolean;  // true if new, false if existing record returned
}
```

**Deduplication:**
- Function checks `taddy_podcast_uuid` and returns existing slug if found
- Race conditions handled via Postgres error code `23505`
- Safe to call multiple times for the same podcast

**Example:**
```typescript
// Fire-and-forget after following podcast
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
```

---

### User & Billing

#### `create-checkout` - Start Pro Subscription

Create a Stripe checkout session for Pro subscription.

| Property | Value |
|----------|-------|
| **Endpoint** | `POST /functions/v1/create-checkout` |
| **Auth Required** | Yes |

**Request Body:** None required

**Response:**
```typescript
interface CreateCheckoutResponse {
  url: string;  // Stripe Checkout URL - redirect user here
}
```

**Post-Purchase:**
- User is redirected to `/library?payment=success`
- `profiles.plan` is updated to `'pro'`
- `profiles.pro_expires_at` is set

---

#### `customer-portal` - Manage Subscription

Get URL for Stripe billing portal.

| Property | Value |
|----------|-------|
| **Endpoint** | `POST /functions/v1/customer-portal` |
| **Auth Required** | Yes |

**Request Body:** None required

**Response:**
```typescript
interface CustomerPortalResponse {
  url: string;  // Stripe Portal URL
}
```

---

#### `cancel-subscription` - Cancel Pro

Cancel user's Pro subscription.

| Property | Value |
|----------|-------|
| **Endpoint** | `POST /functions/v1/cancel-subscription` |
| **Auth Required** | Yes |

**Request Body:** None required

**Response:**
```typescript
interface CancelSubscriptionResponse {
  success: true;
  cancelAt: string;  // ISO date when subscription ends
}
```

---

#### `create-credit-refill` - Buy More Credits

Create checkout for one-time credit purchase.

| Property | Value |
|----------|-------|
| **Endpoint** | `POST /functions/v1/create-credit-refill` |
| **Auth Required** | Yes |

**Request Body:** None required

**Response:**
```typescript
interface CreateCreditRefillResponse {
  url: string;  // Stripe Checkout URL
}
```

---

#### `delete-user` - Delete Account

Permanently delete user account and all data.

| Property | Value |
|----------|-------|
| **Endpoint** | `POST /functions/v1/delete-user` |
| **Auth Required** | Yes |

**Request Body:** None required

**Response:**
```typescript
interface DeleteUserResponse {
  success: true;
  message: string;
}
```

**Notes:**
- Deletes profile, all briefs, saved episodes
- User cannot undo this action
- Auth session is invalidated

---

### Marketing & Analytics

#### `sync-to-loops` - Marketing Automation Sync

Syncs user data to Loops.so for email marketing automation. **Use fire-and-forget pattern.**

| Property | Value |
|----------|-------|
| **Endpoint** | `POST /functions/v1/sync-to-loops` |
| **Auth Required** | No (but requires user context in payload) |

**Request Body:**
```typescript
interface SyncToLoopsRequest {
  action: 'signup' | 'upgraded' | 'downgraded' | 'engagement_update' | 'backfill';
  email: string;                // User email (required)
  userId?: string;              // User UUID
  firstName?: string;           // User's first name
  plan?: string;                // 'free' or 'pro'
  showsFollowed?: number;       // Count of followed podcasts
  briefsGenerated?: number;     // Count of briefs (excluding gifted)
  lastBriefDate?: string;       // ISO date of last brief
  credits?: number;             // Current credit balance
  preferredLanguage?: string;   // ISO 639-1 code
  signupDate?: string;          // Original signup date (for backfill)
}
```

**Response:**
```typescript
interface SyncToLoopsResponse {
  success: boolean;
  error?: string;  // Present if success is false
}
```

**Actions:**

| Action | When to Call | Purpose |
|--------|--------------|---------|
| `signup` | After new user registration | Create contact with initial values |
| `upgraded` | After Pro subscription activated | Update plan to 'pro', trigger email |
| `downgraded` | After subscription cancelled | Update plan to 'free' |
| `engagement_update` | After follow/unfollow, brief generation | Update showsFollowed, briefsGenerated |
| `backfill` | Admin use only | Sync existing users to Loops |

**Getting Accurate Engagement Counts:**
```typescript
// Use the RPC function to get accurate counts
const { data } = await supabase.rpc('get_user_engagement', { 
  p_user_id: userId 
});
// Returns: { shows_followed, briefs_generated, last_brief_date }

// Then sync to Loops
await supabase.functions.invoke('sync-to-loops', {
  body: {
    action: 'engagement_update',
    email: user.email,
    showsFollowed: data.shows_followed,
    briefsGenerated: data.briefs_generated,
    lastBriefDate: data.last_brief_date,
  },
}).catch(console.error);
```

**Example - After Follow:**
```typescript
// 1. Insert to followed_podcasts
await supabase.from('followed_podcasts').insert({ ... });

// 2. Fire-and-forget: Register metadata
supabase.functions.invoke('ensure-podcast-metadata', {
  body: { taddyPodcastUuid, name, ... }
}).catch(console.error);

// 3. Fire-and-forget: Sync engagement to Loops
const { data: engagement } = await supabase.rpc('get_user_engagement', { p_user_id: userId });
supabase.functions.invoke('sync-to-loops', {
  body: {
    action: 'engagement_update',
    email: user.email,
    showsFollowed: engagement.shows_followed,
  },
}).catch(console.error);
```

---

#### Direct Database Inserts for Analytics

Analytics events are inserted directly into tables, not via Edge Functions.

**Log Site Visit:**
```typescript
await supabase.from('analytics_events').insert({
  user_id: user.id,
  event_type: 'site_visit',
});
```

**Log Search:**
```typescript
await supabase.from('analytics_events').insert({
  user_id: user.id,
  event_type: 'podcast_searched',
  metadata: { term: searchQuery },
});
```

**Log Audio Play (Start):**

> ⚠️ **Implementation Note:** See [Mobile Audit Findings](./Mobile_Integration_Guide.md#mobile-audit-findings--required-fixes) - the mobile app currently does NOT implement this tracking.

```typescript
// Generate a unique session ID when starting a new track
const sessionId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

// Track accumulated listening time, NOT just position
// Log START after 30 SECONDS OF ACCUMULATED LISTENING (not 30s position)
await supabase.from('audio_engagement_events').insert({
  user_id: user.id,
  master_brief_id: briefId,        // For episodes: use `episode-${taddyEpisodeUuid}`
  audio_type: 'summary',           // 'summary' or 'full_episode'
  event_type: 'start',
  duration_seconds: totalDuration,
  progress_seconds: currentPosition,
  progress_percentage: Math.round((currentPosition / totalDuration) * 100),
  session_id: sessionId,           // REQUIRED: Used for deduplication
});
```

**Log Audio Completion:**

```typescript
// Log COMPLETION when user reaches 75% POSITION
await supabase.from('audio_engagement_events').insert({
  user_id: user.id,
  master_brief_id: briefId,
  audio_type: 'summary',
  event_type: 'completion',
  duration_seconds: totalDuration,
  progress_seconds: currentPosition,
  progress_percentage: 75,
  session_id: sessionId,           // Same session ID as start event
});
```

**Key Rules:**
- `start` event: Log after **30 seconds of accumulated listening** (track time elapsed while playing, not seeks)
- `completion` event: Log when position reaches **75%**
- Both events use the same `session_id` per track play session
- For full episodes, use `master_brief_id: 'episode-${taddyEpisodeUuid}'`

---

### Utility Functions

#### `log-error` - Client Error Logging

Log client-side errors to the database for debugging and monitoring.

| Property | Value |
|----------|-------|
| **Endpoint** | `POST /functions/v1/log-error` |
| **Auth Required** | No (but validates JWT if present) |

**Request Body:**
```typescript
interface LogErrorRequest {
  error_code?: string;     // Machine-readable error code
  error_message: string;   // Human-readable error description (required)
  error_source: string;    // Source category (required): 'gemini' | 'stripe' | 'edge_function' | 'auth' | 'taddy' | 'unknown'
  url: string;             // Page URL where error occurred (required)
  metadata?: {             // Additional context
    userAgent?: string;
    timestamp?: string;
    [key: string]: unknown;
  };
}
```

**Response:**
```typescript
interface LogErrorResponse {
  success: true;
}
```

**Notes:**
- User ID is extracted from JWT if authenticated (not from request body)
- Use for service-level errors that affect user experience
- Do NOT use for expected business logic (e.g., NO_CREDITS) or user input errors

**Example:**
```typescript
async function logCriticalError(error: Error, source: string) {
  await supabase.functions.invoke('log-error', {
    body: {
      error_message: error.message,
      error_source: source,
      url: window.location.pathname,
      metadata: {
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
      },
    },
  }).catch(() => {}); // Silent fail - don't let logging cause more errors
}
```

---

#### `log-share-visit` - Track Share Link Visits

Log when someone visits a shared brief URL. Records under the SHARER's user ID for attribution.

| Property | Value |
|----------|-------|
| **Endpoint** | `POST /functions/v1/log-share-visit` |
| **Auth Required** | No |

**Request Body:**
```typescript
interface LogShareVisitRequest {
  referrerId: string;     // User ID of the person who shared (required)
  masterBriefId: string;  // UUID of the shared brief (required)
}
```

**Response:**
```typescript
interface LogShareVisitResponse {
  success: true;
}
```

**Security Notes:**
- Both IDs must be valid UUIDs
- Function validates that `referrerId` actually owns the brief
- Returns success even on validation failure (to prevent information leakage)
- Creates `share_link_visited` event in `analytics_events` table

**Example:**
```typescript
// Extract referrer info from share URL: /brief/slug?ref=userId
const params = new URLSearchParams(window.location.search);
const referrerId = params.get('ref');
const masterBriefId = briefData.masterBriefId;

if (referrerId && masterBriefId) {
  supabase.functions.invoke('log-share-visit', {
    body: { referrerId, masterBriefId },
  }).catch(console.error);
}
```

---

## Error Handling

### Standard Error Response

```typescript
interface ErrorResponse {
  error: string;       // Human-readable message
  code?: string;       // Machine-readable code
  details?: unknown;   // Additional context
}
```

### Common HTTP Status Codes

| Code | Meaning | Action |
|------|---------|--------|
| 400 | Bad Request | Check request body format |
| 401 | Unauthorized | Refresh auth token |
| 403 | Forbidden | User lacks permission |
| 404 | Not Found | Resource doesn't exist |
| 429 | Rate Limited | Back off and retry |
| 500 | Server Error | Retry with exponential backoff |

### Error Codes Reference

| Code | Meaning |
|------|---------|
| `CHECKOUT_ERROR` | Stripe checkout creation failed |
| `PORTAL_ERROR` | Stripe portal access failed |
| `AUDIO_URL_GENERATION_FAILED` | Could not create signed URL |
| `INSUFFICIENT_CREDITS` | User has no credits remaining |
| `BRIEF_GENERATION_FAILED` | Pipeline error during generation |

---

## Rate Limits

| Resource | Limit |
|----------|-------|
| Edge Function calls | 1000/hour per user |
| Podcast searches | 60/minute per user |
| Brief generations | 10/minute per user |
| Storage downloads | 100/hour per user |

**Retry Strategy:**
```typescript
async function callWithRetry(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error.status === 429 && i < maxRetries - 1) {
        await sleep(Math.pow(2, i) * 1000); // Exponential backoff
        continue;
      }
      throw error;
    }
  }
}
```

---

## Complete Function Catalog

| Function | Auth | Category | Purpose |
|----------|------|----------|---------|
| `taddy-search` | No | Discovery | Search podcasts |
| `taddy-podcast-details` | No | Discovery | Get show + episodes |
| `taddy-latest-episodes` | Yes | Discovery | New episodes feed |
| `get-episode-details` | No | Content | Single episode with description backfill |
| `get-show-discovery` | No | Content | Show page with brief count |
| `get-show-episodes` | No | Content | Paginated episodes for show |
| `get-show-briefs` | No | Content | Paginated briefs for show |
| `get-explore-shows` | No | Content | Popular shows by brief_count |
| `generate-taddy-brief` | Yes | Briefs | Create AI brief |
| `get-signed-audio-url` | Yes | Briefs | TTS audio URL |
| `get-public-brief-preview` | No | Briefs | Share preview |
| `claim-brief` | Yes | Library | Add shared brief |
| `claim-episode` | Yes | Library | Save episode |
| `ensure-episode-metadata` | No | Metadata | Create episode SEO page |
| `ensure-podcast-metadata` | No | Metadata | Create show SEO page |
| `sync-to-loops` | No | Marketing | Loops.so sync (fire-and-forget) |
| `log-error` | No | Utilities | Client error logging |
| `log-share-visit` | No | Utilities | Track share visits |
| `create-checkout` | Yes | Billing | Pro subscription |
| `customer-portal` | Yes | Billing | Manage billing |
| `cancel-subscription` | Yes | Billing | Cancel Pro |
| `create-credit-refill` | Yes | Billing | Buy credits |
| `delete-user` | Yes | User | Delete account |
| `sitemap` | No | Utilities | XML sitemap |

---

## Appendix: Full Episode Playback

For full podcast episodes, **no Edge Function is needed**. Episodes are streamed directly from their original audio URLs.

```typescript
// Get episode audio URL from Taddy response or saved_episodes
const audioUrl = episode.audioUrl || savedEpisode.episode_audio_url;

// Stream directly - no signing required
audioPlayer.play(audioUrl);
```

**Progress Tracking:**
```typescript
// Save progress to saved_episodes
await supabase
  .from('saved_episodes')
  .update({ 
    audio_progress_seconds: currentPosition,
    is_completed: currentPosition / duration >= 0.75 
  })
  .eq('id', savedEpisodeId);
```

---

*Document generated for PodBrief Mobile App Development*
