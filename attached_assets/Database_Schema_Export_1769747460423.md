# PodBrief Database Schema Export

> Complete database schema reference for mobile app integration.

**Last Updated:** January 30, 2026  
**Database:** PostgreSQL (Supabase)

---

## Table of Contents

1. [Core Tables](#core-tables)
2. [Content Tables](#content-tables)
3. [Analytics Tables](#analytics-tables)
4. [System Tables](#system-tables)
5. [Relationships](#relationships)
6. [Database Functions](#database-functions)
7. [Storage Buckets](#storage-buckets)
8. [RLS Policy Summary](#rls-policy-summary)

---

## Core Tables

### `profiles`

User profile data created on signup.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | No | — | Primary key, matches `auth.users.id` |
| `email` | text | No | — | User's email address |
| `email_canonical` | text | No | — | Normalized email (for duplicate detection) |
| `first_name` | text | Yes | null | User's first name |
| `credits` | integer | No | 5 | Remaining credits for brief generation |
| `plan` | text | No | 'free' | 'free' or 'pro' |
| `preferred_language` | text | No | 'en' | ISO 639-1 language code |
| `pro_expires_at` | timestamptz | Yes | null | When Pro subscription ends |
| `subscription_cancel_at` | timestamptz | Yes | null | When cancelled sub ends |
| `referred_by` | uuid | Yes | null | ID of referring user |
| `created_at` | timestamptz | No | now() | Account creation time |
| `updated_at` | timestamptz | No | now() | Last update time |

**RLS:** Users can only read/update their own profile.

---

### `user_briefs`

Junction table linking users to their AI briefs.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | No | gen_random_uuid() | Primary key |
| `user_id` | uuid | No | — | Owner user ID |
| `master_brief_id` | uuid | No | — | References `master_briefs.id` |
| `slug` | text | No | — | URL-friendly identifier |
| `is_completed` | boolean | No | false | Has user finished listening? |
| `audio_progress_seconds` | integer | Yes | 0 | Playback position in TTS audio |
| `is_hidden` | boolean | No | false | Soft delete flag |
| `is_gifted` | boolean | Yes | false | Was brief claimed via share link? |
| `preferred_language` | text | No | 'en' | Language of this user's copy |
| `total_duration_minutes` | integer | Yes | null | Episode duration for display |
| `created_at` | timestamptz | No | now() | When user acquired brief |
| `updated_at` | timestamptz | No | now() | Last update |

**RLS:** Users can CRUD their own briefs only. Admins can read all briefs for customer support.

**Important:** Query `user_briefs` with `is_hidden = false` to get active library.

---

### `saved_episodes`

Full podcast episodes saved by users (no brief generated yet).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | No | gen_random_uuid() | Primary key |
| `user_id` | uuid | No | — | Owner user ID |
| `taddy_episode_uuid` | text | No | — | Taddy's episode identifier |
| `taddy_podcast_uuid` | text | No | — | Taddy's podcast identifier |
| `episode_name` | text | No | — | Episode title |
| `podcast_name` | text | No | — | Show name |
| `episode_thumbnail` | text | Yes | null | Image URL |
| `episode_audio_url` | text | Yes | null | Direct audio stream URL |
| `episode_duration_seconds` | integer | Yes | null | Episode length |
| `episode_published_at` | timestamptz | Yes | null | Original publish date |
| `is_completed` | boolean | Yes | false | Has user finished? |
| `audio_progress_seconds` | integer | Yes | 0 | Playback position |
| `created_at` | timestamptz | Yes | now() | When saved |
| `updated_at` | timestamptz | Yes | now() | Last update |

**RLS:** Users can CRUD their own saved episodes.

**Unique Constraint:** `(user_id, taddy_episode_uuid)`

---

### `followed_podcasts`

Podcasts followed by users.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | No | gen_random_uuid() | Primary key |
| `user_id` | uuid | No | — | Owner user ID |
| `taddy_podcast_uuid` | text | No | — | Taddy's podcast identifier |
| `podcast_name` | text | No | — | Show name |
| `podcast_description` | text | Yes | null | Show description |
| `podcast_image_url` | text | Yes | null | Cover art URL |
| `author_name` | text | Yes | null | Publisher/host |
| `total_episodes_count` | integer | Yes | null | Episode count |
| `created_at` | timestamptz | No | now() | When followed |
| `updated_at` | timestamptz | No | now() | Last update |

**RLS:** Users can CRUD their own follows.

**Unique Constraint:** `(user_id, taddy_podcast_uuid)`

---

## Content Tables

### `master_briefs`

Canonical AI-generated brief content (shared across users).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | No | gen_random_uuid() | Primary key |
| `taddy_episode_uuid` | text | Yes | null | Source episode |
| `taddy_podcast_uuid` | text | Yes | null | Source podcast |
| `language` | text | No | 'en' | Brief language |
| `podcast_name` | text | Yes | null | Show name |
| `episode_name` | text | Yes | null | Episode title |
| `episode_thumbnail` | text | Yes | null | Image URL |
| `episode_audio_url` | text | Yes | null | Original audio URL |
| `episode_duration_seconds` | integer | Yes | null | Episode length |
| `episode_published_at` | timestamptz | Yes | null | Original publish date |
| `episode_slug` | text | Yes | null | SEO-friendly episode URL |
| `slug` | text | Yes | null | Brief URL slug |
| `transcript_content` | text | Yes | null | Full transcript |
| `ai_condensed_transcript` | text | Yes | null | Shortened transcript |
| `summary_text` | text | Yes | null | AI summary (markdown) |
| `summary_phase` | text | Yes | null | Processing phase |
| `audio_url` | text | Yes | null | TTS audio path |
| `audio_status` | text | Yes | 'none' | Audio generation status |
| `audio_duration_seconds` | integer | Yes | null | TTS audio length |
| `audio_error` | text | Yes | null | Audio generation error |
| `pipeline_status` | text | Yes | 'pending' | Overall status |
| `pipeline_error` | text | Yes | null | Pipeline error message |
| `pipeline_completed_at` | timestamptz | Yes | null | Completion time |
| `processing_lock_holder` | text | Yes | null | Concurrency lock |
| `processing_started_at` | timestamptz | Yes | null | When processing began |
| `transcript_completed_at` | timestamptz | Yes | null | Transcript done time |
| `summary_completed_at` | timestamptz | Yes | null | Summary done time |
| `total_duration_minutes` | integer | Yes | null | Episode length (minutes) |
| `source` | text | Yes | 'youtube' | Content source |
| `created_at` | timestamptz | No | now() | Creation time |
| `updated_at` | timestamptz | No | now() | Last update |

**Pipeline Status Values:**
- `pending` - Queued for processing
- `transcribing` - Getting transcript
- `summarizing` - Generating summary
- `recording` - Generating TTS audio
- `completed` - Ready to use
- `failed` - Processing failed

**RLS:** Users can read briefs they own (via `user_briefs` join). Admins can read all.

**Unique Constraint:** `(taddy_episode_uuid, language)`

---

### `podcast_metadata`

SEO-friendly podcast pages for discovery.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | No | gen_random_uuid() | Primary key |
| `taddy_podcast_uuid` | text | No | — | Taddy identifier |
| `slug` | text | No | — | URL-friendly identifier |
| `name` | text | No | — | Show name |
| `description` | text | Yes | null | Show description |
| `image_url` | text | Yes | null | Cover art |
| `author_name` | text | Yes | null | Publisher/host |
| `total_episodes_count` | integer | Yes | null | Episode count |
| `created_at` | timestamptz | No | now() | Creation time |
| `updated_at` | timestamptz | No | now() | Last update |

**RLS:** Public read access. No anonymous writes.

---

### `episode_metadata`

SEO-friendly episode pages.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | No | gen_random_uuid() | Primary key |
| `taddy_episode_uuid` | text | No | — | Taddy identifier |
| `taddy_podcast_uuid` | text | No | — | Parent podcast |
| `slug` | text | No | — | URL-friendly identifier |
| `name` | text | No | — | Episode title |
| `description` | text | Yes | null | Episode description |
| `image_url` | text | Yes | null | Episode image |
| `audio_url` | text | Yes | null | Direct audio URL |
| `podcast_name` | text | No | — | Parent show name |
| `podcast_slug` | text | Yes | null | Parent show slug |
| `podcast_image_url` | text | Yes | null | Show cover art |
| `duration_seconds` | integer | Yes | null | Episode length |
| `published_at` | timestamptz | Yes | null | Original publish date |
| `master_brief_id` | uuid | Yes | null | Associated brief (if any) |
| `created_at` | timestamptz | Yes | now() | Creation time |
| `updated_at` | timestamptz | Yes | now() | Last update |

**RLS:** Public read access. No anonymous writes.

---

## Analytics Tables

### `analytics_events`

General analytics events.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | No | gen_random_uuid() | Primary key |
| `user_id` | uuid | No | — | User who triggered event |
| `event_type` | text | No | — | Event type (see below) |
| `brief_id` | uuid | Yes | null | Related brief |
| `language` | text | Yes | null | Language context |
| `metadata` | jsonb | Yes | {} | Additional data |
| `created_at` | timestamptz | No | now() | Event time |

**Event Types:**
- `site_visit` - User opened app
- `podcast_searched` - User searched
- `summary_generated` - Brief created
- `share_link_visited` - Someone visited share link

**RLS:** Users can insert their own events. Admins can read all.

---

### `audio_engagement_events`

Audio playback analytics.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | No | gen_random_uuid() | Primary key |
| `user_id` | uuid | No | — | Listener |
| `master_brief_id` | uuid | No | — | Content played |
| `audio_type` | text | No | — | 'summary' or 'full_episode' |
| `event_type` | text | No | — | 'start' or 'completion' |
| `duration_seconds` | integer | Yes | null | Total content length |
| `progress_seconds` | integer | Yes | null | Current position |
| `progress_percentage` | numeric | Yes | null | Completion percentage |
| `session_id` | text | Yes | null | Group related events |
| `created_at` | timestamptz | No | now() | Event time |

**RLS:** Users can insert their own events. Admins can read all.

---

## System Tables

### `user_roles`

Role-based access control.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | No | gen_random_uuid() | Primary key |
| `user_id` | uuid | No | — | User ID |
| `role` | app_role | No | — | 'admin' or 'user' |
| `created_at` | timestamptz | No | now() | Assignment time |

**Enum `app_role`:** `admin`, `user`

**Unique Constraint:** `(user_id, role)`

---

### `error_logs`

Error tracking.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | No | gen_random_uuid() | Primary key |
| `user_id` | uuid | Yes | null | Affected user |
| `error_code` | text | Yes | null | Error identifier |
| `error_message` | text | No | — | Error description |
| `error_source` | text | No | — | Origin (frontend, edge_function, etc.) |
| `url` | text | No | — | Where error occurred |
| `metadata` | jsonb | Yes | {} | Additional context |
| `resolved` | boolean | Yes | false | Admin resolution flag |
| `created_at` | timestamptz | No | now() | Error time |

---

### `ai_config`

Dynamic AI configuration.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | No | gen_random_uuid() | Primary key |
| `config_key` | text | No | — | Setting name |
| `config_value` | numeric | No | — | Numeric value |
| `text_value` | text | Yes | null | Text value |
| `description` | text | Yes | null | Setting description |
| `updated_at` | timestamptz | Yes | now() | Last update |
| `updated_by` | uuid | Yes | null | Admin who updated |

**Common Keys:**
- `extraction_temperature` - AI extraction temp
- `synthesis_temperature` - AI synthesis temp
- `openai_tts_voice` - TTS voice selection
- `summary_header` - Prepend to summaries
- `summary_footer` - Append to summaries

---

### `ai_prompts`

Editable AI prompt templates.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | No | gen_random_uuid() | Primary key |
| `prompt_key` | text | No | — | Identifier |
| `prompt_name` | text | No | — | Display name |
| `description` | text | Yes | null | Purpose description |
| `system_prompt` | text | No | — | The actual prompt |
| `updated_at` | timestamptz | No | now() | Last update |
| `updated_by` | uuid | Yes | null | Admin who updated |

**Prompt Keys:**
- `extraction` - Transcript analysis prompt
- `synthesis` - Summary generation prompt

---

## Relationships

### Entity Relationship Diagram

```
┌─────────────────┐
│     profiles    │
│─────────────────│
│ id (PK)         │◄──────────────────────────────────────┐
│ referred_by     │────────────────────────────────────┐  │
└────────┬────────┘                                    │  │
         │                                             │  │
         │ 1:M                                         │  │
         ▼                                             │  │
┌─────────────────┐       ┌─────────────────┐         │  │
│   user_briefs   │       │  master_briefs  │         │  │
│─────────────────│       │─────────────────│         │  │
│ id (PK)         │       │ id (PK)         │◄────────┤  │
│ user_id (FK)    │───────│ ...             │         │  │
│ master_brief_id │──────►│                 │         │  │
└─────────────────┘       └────────┬────────┘         │  │
                                   │                  │  │
         ┌─────────────────────────┼──────────────────┘  │
         │                         │                     │
         │ 1:M                     │ 1:1 (optional)      │
         ▼                         ▼                     │
┌─────────────────┐       ┌─────────────────┐            │
│audio_engagement │       │episode_metadata │            │
│    _events      │       │─────────────────│            │
│─────────────────│       │ master_brief_id │────────────┘
│ master_brief_id │───────│                 │
└─────────────────┘       └─────────────────┘

┌─────────────────┐       ┌─────────────────┐
│ saved_episodes  │       │followed_podcasts│
│─────────────────│       │─────────────────│
│ user_id (FK)    │       │ user_id (FK)    │
└─────────────────┘       └─────────────────┘
```

### Key Relationships

| Relationship | Type | Description |
|--------------|------|-------------|
| profiles → user_briefs | 1:M | User owns many briefs |
| profiles → saved_episodes | 1:M | User saves many episodes |
| profiles → followed_podcasts | 1:M | User follows many shows |
| profiles → profiles | 1:M | Referral chain |
| user_briefs → master_briefs | M:1 | Many users can share one brief |
| master_briefs → episode_metadata | 1:1 | Brief links to episode page |
| master_briefs → audio_engagement_events | 1:M | Brief has many plays |

---

## Database Functions

### `has_role(user_id, role)`

Check if user has specific role.

```sql
SELECT has_role(auth.uid(), 'admin'); -- Returns boolean
```

### `generate_user_brief_slug(title, user_id)`

Generate unique slug for user's brief.

```sql
SELECT generate_user_brief_slug('Episode Title Here', '123e4567-...');
-- Returns: 'episode-title-here' or 'episode-title-here-1' if collision
```

### `generate_slug(title)`

Generate unique slug for master brief.

```sql
SELECT generate_slug('My Podcast Episode');
-- Returns: 'my-podcast-episode-abc123'
```

### `get_user_engagement(user_id)`

Get user's engagement metrics.

```sql
SELECT * FROM get_user_engagement('123e4567-...');
-- Returns: (shows_followed, briefs_generated, last_brief_date)
```

### `acquire_master_brief_lock(episode_uuid, language, lock_holder)`

Concurrency control for brief generation.

```sql
SELECT acquire_master_brief_lock('ep-uuid', 'en', 'request-123');
-- Returns: master_brief_id if lock acquired, NULL otherwise
```

---

## Storage Buckets

### `brief-audio`

Stores TTS-generated audio files.

| Property | Value |
|----------|-------|
| **Bucket Name** | `brief-audio` |
| **Public** | No |
| **Access** | Via signed URLs only |
| **File Format** | MP3 |
| **Path Pattern** | `{master_brief_id}.mp3` |

**Getting Access:**
```typescript
// Must call get-signed-audio-url Edge Function
const { data } = await supabase.functions.invoke('get-signed-audio-url', {
  body: { masterBriefId }
});
const audioUrl = data.signedUrl; // Valid 15 minutes
```

---

## RLS Policy Summary

### User Data Tables

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| profiles | Own only | Own only | Own only | — |
| user_briefs | Own + Admin | Own only | Own only | Own only |
| saved_episodes | Own only | Own only | Own only | Own only |
| followed_podcasts | Own only | Own only | — | Own only |

### Content Tables

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| master_briefs | Owners + Admins | — | — | — |
| podcast_metadata | Public | — | — | — |
| episode_metadata | Public | — | — | — |

### Analytics Tables

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| analytics_events | Admins only | Own only | — | — |
| audio_engagement_events | Own + Admins | Own only | — | — |

### System Tables

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| user_roles | Own + Admins | Admins only | Admins only | Admins only |
| error_logs | Admins only | Own only | Admins only | Admins only |
| ai_config | Admins only | — | Admins only | — |
| ai_prompts | Admins only | — | Admins only | — |

### Anonymous Access

All tables have `USING (false)` policies for anonymous users, meaning:
- Anonymous users cannot read any user data
- Anonymous users cannot read master_briefs directly
- Anonymous users CAN read `podcast_metadata` and `episode_metadata`
- Public brief previews are served via `get-public-brief-preview` Edge Function

---

## TypeScript Types

For complete TypeScript type definitions, see the auto-generated types in your Supabase client:

```typescript
import { Database } from '@/integrations/supabase/types';

type Profile = Database['public']['Tables']['profiles']['Row'];
type UserBrief = Database['public']['Tables']['user_briefs']['Row'];
type MasterBrief = Database['public']['Tables']['master_briefs']['Row'];
type SavedEpisode = Database['public']['Tables']['saved_episodes']['Row'];
type FollowedPodcast = Database['public']['Tables']['followed_podcasts']['Row'];
```

---

## Quick Reference: Common Queries

### Get User's Library

```typescript
// Briefs with full content
const { data: briefs } = await supabase
  .from('user_briefs')
  .select(`
    *,
    master_brief:master_briefs(
      episode_name, podcast_name, episode_thumbnail,
      summary_text, audio_url, audio_duration_seconds,
      pipeline_status
    )
  `)
  .eq('user_id', userId)
  .eq('is_hidden', false)
  .order('created_at', { ascending: false });

// Saved episodes
const { data: episodes } = await supabase
  .from('saved_episodes')
  .select('*')
  .eq('user_id', userId)
  .order('created_at', { ascending: false });

// Followed shows
const { data: shows } = await supabase
  .from('followed_podcasts')
  .select('*')
  .eq('user_id', userId)
  .order('podcast_name');
```

### Check User's Subscription

```typescript
const { data: profile } = await supabase
  .from('profiles')
  .select('plan, credits, pro_expires_at')
  .eq('id', userId)
  .single();

const isPro = profile.plan === 'pro' && 
  (!profile.pro_expires_at || new Date(profile.pro_expires_at) > new Date());
const hasCredits = isPro || profile.credits > 0;
```

---

*Document generated for PodBrief Mobile App Development*
