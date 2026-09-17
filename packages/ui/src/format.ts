/**
 * Display formatting. Timestamps arrive from the API in UTC and are shown in
 * Asia/Manila — the only place conversion happens (CLAUDE.md non-negotiable #6).
 */

const MANILA = "Asia/Manila";

const dateTime = new Intl.DateTimeFormat("en-PH", {
  timeZone: MANILA,
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const dateOnly = new Intl.DateTimeFormat("en-PH", {
  timeZone: MANILA,
  year: "numeric",
  month: "short",
  day: "numeric",
});

export function formatDateTime(iso: string | null | undefined): string {
  return iso ? dateTime.format(new Date(iso)) : "—";
}

export function formatDate(isoOrDate: string | null | undefined): string {
  if (!isoOrDate) return "—";
  // A bare YYYY-MM-DD is already a Manila calendar day; anchor it at Manila noon
  // so no timezone shift can move it to a neighbouring day.
  const value = /^\d{4}-\d{2}-\d{2}$/.test(isoOrDate) ? `${isoOrDate}T12:00:00+08:00` : isoOrDate;
  return dateOnly.format(new Date(value));
}

/** "3 hours ago", relative to `now`. */
export function formatRelative(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return "never";
  const seconds = Math.round((now.getTime() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} days ago`;
}

/** Today in Manila as YYYY-MM-DD, for date inputs. */
export function manilaToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: MANILA }).format(now);
}

export function shiftDays(ymd: string, days: number): string {
  const date = new Date(`${ymd}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Save a Blob as a file — for report downloads fetched with the session cookie. */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
