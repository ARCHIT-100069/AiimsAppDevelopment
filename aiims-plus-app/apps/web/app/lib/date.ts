/**
 * Asia/Kolkata is the timezone used for every clinician/patient-facing
 * timestamp in this India-first product — "today" for OPD/booking purposes
 * must mean the IST calendar day, not the server's UTC day. Using UTC here
 * would show yesterday's date (and yesterday's slots/queue) for the first
 * ~5.5 hours of every IST day (00:00–05:29 IST = still "yesterday" in UTC).
 */

/** Today's date in IST, as YYYY-MM-DD. */
export function todayIST(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

/** The UTC instant range spanning one IST calendar day — for date-range queries. */
export function istDayWindow(date: string): { from: string; to: string } {
  return {
    from: new Date(`${date}T00:00:00+05:30`).toISOString(),
    to: new Date(`${date}T23:59:59.999+05:30`).toISOString(),
  };
}

/**
 * Deterministic IST display formatters — hand-rolled, not `toLocaleString`.
 * These render as part of server-side HTML and are then re-rendered client
 * side during hydration; `Intl`'s AM/PM casing and separator conventions
 * (e.g. "10:30 am" vs "10:30 AM", "," vs " at ") differ between Node's ICU
 * and a browser's — WebKit in particular disagrees with Node/Chromium/
 * Firefox here. That mismatch makes React discard and re-render the whole
 * subtree on first paint (a visible flash) and log a hydration warning.
 * Plain arithmetic on the epoch has no such ambiguity on any engine.
 */
const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;
const MONTHS_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;
const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const WEEKDAYS_LONG = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

/** Shifts to IST wall-clock time; read back with the UTC getters below (India
 *  has one fixed +5:30 offset, no DST, so this arithmetic is always exact). */
function ist(d: Date): Date {
  return new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
}
const pad2 = (n: number) => String(n).padStart(2, "0");

function timeOf(d: Date): string {
  const hour24 = d.getUTCHours();
  const ampm = hour24 >= 12 ? "pm" : "am";
  const hour12 = hour24 % 12 || 12;
  return `${hour12}:${pad2(d.getUTCMinutes())} ${ampm}`;
}

/** "27 Aug" */
export function formatDayMonth(iso: string): string {
  const d = ist(new Date(iso));
  return `${d.getUTCDate()} ${MONTHS_SHORT[d.getUTCMonth()]}`;
}
/** "27 Aug 2026" */
export function formatDateShort(iso: string): string {
  const d = ist(new Date(iso));
  return `${d.getUTCDate()} ${MONTHS_SHORT[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
/** "27 Aug, 10:30 am" */
export function formatDayMonthTime(iso: string): string {
  const d = ist(new Date(iso));
  return `${d.getUTCDate()} ${MONTHS_SHORT[d.getUTCMonth()]}, ${timeOf(d)}`;
}
/** "27 Aug 2026, 10:30 am" */
export function formatDateTimeShort(iso: string): string {
  const d = ist(new Date(iso));
  return `${d.getUTCDate()} ${MONTHS_SHORT[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${timeOf(d)}`;
}
/** "10:30 am" */
export function formatTime(iso: string): string {
  return timeOf(ist(new Date(iso)));
}
/** "Mon" */
export function formatWeekdayShort(iso: string): string {
  return WEEKDAYS_SHORT[ist(new Date(iso)).getUTCDay()]!;
}
/** "Thursday, 27 August" — for "today" headers; defaults to the current moment. */
export function formatTodayHeader(d: Date = new Date()): string {
  const i = ist(d);
  return `${WEEKDAYS_LONG[i.getUTCDay()]}, ${i.getUTCDate()} ${MONTHS_LONG[i.getUTCMonth()]}`;
}
/** "2026-08-27" (IST calendar day) — for date-chip values, not display. */
export function isoDateIST(d: Date): string {
  const i = ist(d);
  return `${i.getUTCFullYear()}-${pad2(i.getUTCMonth() + 1)}-${pad2(i.getUTCDate())}`;
}
