# PodBrief Mobile API Contract

> Complete API reference for building iOS/Android apps that connect to the PodBrief backend.

**Last Updated:** January 28, 2026  
**API Version:** 1.0

---

## Table of Contents

1. [Connection Details](#connection-details)
2. [Authentication](#authentication)
3. [Edge Function Reference](#edge-function-reference)
   - [Podcast Discovery](#podcast-discovery)
   - [Brief Generation & Access](#brief-generation--access)
   - [Library Management](#library-management)
   - [User & Billing](#user--billing)
   - [Analytics](#analytics)
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

### Analytics

#### Direct Database Inserts

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
```typescript
await supabase.from('audio_engagement_events').insert({
  user_id: user.id,
  master_brief_id: briefId,
  audio_type: 'summary',  // or 'full_episode'
  event_type: 'start',
  duration_seconds: totalDuration,
  progress_seconds: 30,  // Log at 30 seconds
  progress_percentage: 10,
});
```

**Log Audio Completion:**
```typescript
await supabase.from('audio_engagement_events').insert({
  user_id: user.id,
  master_brief_id: briefId,
  audio_type: 'summary',
  event_type: 'completion',
  duration_seconds: totalDuration,
  progress_seconds: currentPosition,
  progress_percentage: 75,  // Trigger at 75%
});
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
| `get-show-discovery` | No | Discovery | Show page data |
| `get-show-episodes` | No | Discovery | Paginated episodes |
| `get-show-briefs` | No | Discovery | Show's briefs |
| `get-explore-shows` | No | Discovery | Featured shows |
| `get-episode-details` | No | Discovery | Single episode data |
| `generate-taddy-brief` | Yes | Briefs | Create AI brief |
| `get-signed-audio-url` | Yes | Briefs | TTS audio URL |
| `get-public-brief-preview` | No | Briefs | Share preview |
| `claim-brief` | Yes | Library | Add shared brief |
| `claim-episode` | Yes | Library | Save episode |
| `ensure-episode-metadata` | No | Library | Create episode page |
| `ensure-podcast-metadata` | No | Library | Create show page |
| `create-checkout` | Yes | Billing | Pro subscription |
| `customer-portal` | Yes | Billing | Manage billing |
| `cancel-subscription` | Yes | Billing | Cancel Pro |
| `create-credit-refill` | Yes | Billing | Buy credits |
| `delete-user` | Yes | User | Delete account |
| `log-error` | No | Utilities | Client error logging |
| `log-share-visit` | No | Utilities | Track share visits |
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
