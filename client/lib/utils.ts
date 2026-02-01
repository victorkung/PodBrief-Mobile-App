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
