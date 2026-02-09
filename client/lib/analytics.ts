import { supabase } from "@/lib/supabase";

export function sanitizeBriefId(id: string | undefined): string | null {
  if (!id) return null;
  return id.replace(/^episode-/, "") || null;
}

export type AnalyticsEventType =
  | "site_visit"
  | "podcast_searched"
  | "summary_generated"
  | "audio_played"
  | "full_episode_played"
  | "share_initiated";

interface LogAnalyticsEventParams {
  eventType: AnalyticsEventType;
  briefId?: string;
  language?: string;
  metadata?: Record<string, any>;
}

export async function logAnalyticsEvent(params: LogAnalyticsEventParams): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const cleanBriefId = params.briefId ? sanitizeBriefId(params.briefId) : null;

    const insertData: Record<string, any> = {
      user_id: user.id,
      event_type: params.eventType,
      client_platform: "mobile",
    };

    if (cleanBriefId) {
      insertData.brief_id = cleanBriefId;
    }
    if (params.language) {
      insertData.language = params.language;
    }
    if (params.metadata) {
      insertData.metadata = params.metadata;
    }

    const { error } = await supabase.from("analytics_events").insert(insertData);

    if (error) {
      console.error(`[Analytics] Failed to log ${params.eventType}:`, error.message);
    } else {
      console.log(`[Analytics] Logged ${params.eventType}`);
    }
  } catch (err) {
    console.error(`[Analytics] Error logging ${params.eventType}:`, err);
  }
}

let lastSearchLogTime = 0;
const SEARCH_DEBOUNCE_MS = 5 * 60 * 1000;

export async function logSearchEvent(term: string): Promise<void> {
  const now = Date.now();
  if (now - lastSearchLogTime < SEARCH_DEBOUNCE_MS) return;
  lastSearchLogTime = now;

  await logAnalyticsEvent({
    eventType: "podcast_searched",
    metadata: { term },
  });
}

let siteVisitLogged = false;

export async function logSiteVisit(): Promise<void> {
  if (siteVisitLogged) return;
  siteVisitLogged = true;

  await logAnalyticsEvent({ eventType: "site_visit" });
}

export function resetSiteVisitFlag(): void {
  siteVisitLogged = false;
}
