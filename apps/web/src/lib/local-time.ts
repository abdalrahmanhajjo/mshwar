import { formatDate } from "@/i18n/format";
import type { Locale } from "@/lib/locale";

/** Everything on the ground happens on Lebanese time, whatever the traveller's phone says. */
export const BEIRUT = "Asia/Beirut";

export function beirutDateTime(locale: Locale, iso: string): string {
  return formatDate(locale, iso, { dateStyle: "medium", timeStyle: "short", timeZone: BEIRUT });
}

export function beirutTimeOnly(locale: Locale, iso: string): string {
  return formatDate(locale, iso, { dateStyle: undefined, hour: "2-digit", minute: "2-digit", timeZone: BEIRUT });
}

/** Minutes Beirut is ahead of UTC at a given instant (120 in winter, 180 in summer). */
function beirutOffsetMinutes(instant: number): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: BEIRUT,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(instant));
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  return Math.round((asUtc - Math.floor(instant / 60_000) * 60_000) / 60_000);
}

/** "2026-10-02" + "09:30" on Beirut's clock, as an ISO instant. */
export function beirutToIso(date: string, time: string): string {
  const [y = 0, m = 1, d = 1] = date.split("-").map(Number);
  const [h = 0, min = 0] = time.split(":").map(Number);
  const naive = Date.UTC(y, m - 1, d, h, min);
  let instant = naive - beirutOffsetMinutes(naive) * 60_000;
  instant = naive - beirutOffsetMinutes(instant) * 60_000;
  return new Date(instant).toISOString();
}

/** Today's date on Beirut's clock, "YYYY-MM-DD". */
export function beirutToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: BEIRUT }).format(now);
}

/** Days from Beirut's today until a date ("YYYY-MM-DD"); negative when past. */
export function daysUntil(date: string, now = new Date()): number {
  const today = Date.parse(`${beirutToday(now)}T00:00:00Z`);
  return Math.round((Date.parse(`${date}T00:00:00Z`) - today) / 86_400_000);
}
