export function stripHtml(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function formatDate(date: number | string | null): string {
  if (!date) return "";
  let d: Date;
  if (typeof date === "number") {
    if (date < 10000000000) {
      d = new Date(date * 1000);
    } else {
      d = new Date(date);
    }
  } else {
    d = new Date(date);
  }
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatDateLong(date: number | string | null): string {
  if (!date) return "";
  let d: Date;
  if (typeof date === "number") {
    if (date < 10000000000) {
      d = new Date(date * 1000);
    } else {
      d = new Date(date);
    }
  } else {
    d = new Date(date);
  }
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

const LANGUAGE_LABELS: Record<string, string> = {
  en: "English",
  es: "Spanish",
  fr: "French",
  de: "German",
  it: "Italian",
  pt: "Portuguese",
  nl: "Dutch",
  ru: "Russian",
  ja: "Japanese",
  ko: "Korean",
  zh: "Mandarin Chinese",
  ar: "Arabic",
  hi: "Hindi",
  sv: "Swedish",
  da: "Danish",
  no: "Norwegian",
  fi: "Finnish",
  pl: "Polish",
  tr: "Turkish",
  cs: "Czech",
  el: "Greek",
  he: "Hebrew",
  th: "Thai",
  vi: "Vietnamese",
  id: "Indonesian",
  ms: "Malay",
  uk: "Ukrainian",
  ro: "Romanian",
  hu: "Hungarian",
};

export function getLanguageLabel(languageCode: string | null | undefined): string {
  if (!languageCode) return "English";
  const code = languageCode.toLowerCase().split("-")[0];
  return LANGUAGE_LABELS[code] || languageCode.toUpperCase();
}

export function getWordCount(text: string): number {
  if (!text || !text.trim()) return 0;
  const whitespaceWords = text.trim().split(/\s+/).filter(w => w.length > 0).length;
  const cjkPattern = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/g;
  const cjkChars = (text.match(cjkPattern) || []).length;
  return cjkChars > whitespaceWords ? cjkChars : whitespaceWords;
}

export function calculateReadingTime(text: string, wordsPerMinute: number = 300): number {
  const wordCount = getWordCount(text);
  return Math.max(1, Math.ceil(wordCount / wordsPerMinute));
}
