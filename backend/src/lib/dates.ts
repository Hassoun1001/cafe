// A date-only string like "2026-07-04" parses as 2026-07-04T00:00:00.000Z —
// the very start of that day. Used directly as an upper bound (`lte`) that
// excludes almost the entire day, since "now" is always later than midnight.
// This returns the start of the *next* day so callers can use `lt` instead,
// making the given date inclusive of its whole span.
export function endOfDayExclusive(dateStr: string): Date {
  const d = new Date(dateStr);
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}
