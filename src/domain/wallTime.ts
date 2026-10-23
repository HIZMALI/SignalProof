// Calendar parsing is independent of the device's local zone.
export function parseWallTime(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const [year, month, day, hour, minute] = value.split(/[-T:]/).map(Number);
  if (year < 1000 || year > 9999) return null;
  const stamp = Date.UTC(year, month - 1, day, hour, minute);
  const date = new Date(stamp);
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day &&
    date.getUTCHours() === hour &&
    date.getUTCMinutes() === minute
    ? stamp
    : null;
}
const formatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});
export function formatWallTime(value: string): string {
  const stamp = parseWallTime(value);
  return stamp === null
    ? "[not specified — valid date and time required]"
    : formatter.format(stamp);
}
