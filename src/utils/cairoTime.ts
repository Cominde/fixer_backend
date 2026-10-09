/**
 * Calendar helpers pinned to Africa/Cairo, independent of the server's TZ.
 * Egypt observes daylight saving, so offsets are looked up per instant.
 */
const CAIRO_TZ = "Africa/Cairo";

const partsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: CAIRO_TZ,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

const cairoParts = (date: Date) => {
  const parts = partsFormatter.formatToParts(date);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
};

/** Milliseconds Cairo is ahead of UTC at [date]. */
const cairoOffsetMs = (date: Date) => {
  const p = cairoParts(date);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - (date.getTime() - date.getUTCMilliseconds());
};

/** The UTC instant of a Cairo wall-clock time. [month0] is zero-based and may overflow. */
export const cairoWallTimeToUtc = (
  year: number,
  month0: number,
  day = 1,
  hour = 0,
  minute = 0,
  second = 0,
) => {
  const guess = Date.UTC(year, month0, day, hour, minute, second);
  const first = cairoOffsetMs(new Date(guess));
  let utc = guess - first;
  const second_ = cairoOffsetMs(new Date(utc));
  if (second_ !== first) utc = guess - second_;
  return new Date(utc);
};

/** [start, end) of a calendar month in Cairo. [month] is 1-12. */
export const cairoMonthRange = (year: number, month: number) => ({
  start: cairoWallTimeToUtc(year, month - 1, 1),
  end: cairoWallTimeToUtc(year, month, 1),
});

/** [start, end) of the Cairo calendar day containing [date]. */
export const cairoDayRange = (date = new Date()) => {
  const p = cairoParts(date);
  return {
    start: cairoWallTimeToUtc(p.year, p.month - 1, p.day),
    end: cairoWallTimeToUtc(p.year, p.month - 1, p.day + 1),
  };
};

/** Parses "YYYY-MM-DD" as a Cairo calendar date; null when malformed. */
export const parseCairoDate = (value: unknown) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value ?? ""));
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
};

/** Current Cairo year and month (1-12). */
export const cairoYearMonth = (date = new Date()) => {
  const p = cairoParts(date);
  return { year: p.year, month: p.month };
};

/** Payroll period key, e.g. "2026-10". */
export const cairoPeriod = (date = new Date()) => {
  const { year, month } = cairoYearMonth(date);
  return `${year}-${String(month).padStart(2, "0")}`;
};

/** The period key before [period] ("2026-01" → "2025-12"). */
export const previousPeriod = (period: string) => {
  const [y, m] = period.split("-").map(Number);
  const index = y * 12 + (m - 1) - 1;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
};
