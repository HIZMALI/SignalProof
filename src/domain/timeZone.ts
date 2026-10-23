import { Temporal } from "@js-temporal/polyfill";
import type { Draft, Occurrence, TimeInterpretation } from "./types";
import { formatWallTime, parseWallTime } from "./wallTime";

export const TIME_ZONE_ENGINE = "Temporal-polyfill-0.5.1/runtime-Intl";
export const COMMON_ZONES = [
  "Europe/London",
  "Europe/Istanbul",
  "America/New_York",
  "America/Los_Angeles",
  "Asia/Tokyo",
  "Etc/UTC",
];
export interface TimeCandidate {
  epochMilliseconds: number;
  instant: string;
  offset: string;
}
export interface TimeResolution {
  status:
    "valid" | "invalid-date" | "invalid-zone" | "nonexistent" | "ambiguous";
  candidates: TimeCandidate[];
  selected: TimeCandidate | null;
}
export function validInterpretation(
  value: unknown,
): value is TimeInterpretation {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const data = value as Record<string, unknown>;
  return (
    data.mode === "iana" &&
    Object.keys(data).every((key) =>
      ["mode", "startOccurrence", "endOccurrence"].includes(key),
    ) &&
    [data.startOccurrence, data.endOccurrence].every(
      (v) => v === undefined || v === "earlier" || v === "later",
    )
  );
}
export function fixedOffset(value: string): number | null {
  // Legacy descriptions retain their explicitly supplied offset; never infer a location.
  const matches = Array.from(
    value.trim().matchAll(/\b(?:UTC|GMT)(?:([+-])(\d{1,2}):?(\d{2}))?\b/gi),
  );
  if (matches.length !== 1) return null;
  const match = matches[0];
  if (!match[1]) return /\b(?:UTC|GMT)[+-]/i.test(value) ? null : 0;
  const hours = Number(match[2]);
  const minutes = Number(match[3]);
  return hours <= 23 && minutes <= 59
    ? (match[1] === "-" ? -1 : 1) * (hours * 60 + minutes)
    : null;
}
export function offsetLabel(minutes: number): string {
  return `${minutes < 0 ? "-" : "+"}${String(Math.floor(Math.abs(minutes) / 60)).padStart(2, "0")}:${String(Math.abs(minutes) % 60).padStart(2, "0")}`;
}
export function validZone(draft: Draft): boolean {
  if (!draft.timeInterpretation) return fixedOffset(draft.timeZone) !== null;
  if (
    !validInterpretation(draft.timeInterpretation) ||
    !draft.timeZone ||
    /^[+-]/.test(draft.timeZone)
  )
    return false;
  try {
    Temporal.ZonedDateTime.from({
      timeZone: draft.timeZone,
      year: 2026,
      month: 1,
      day: 1,
    });
    return true;
  } catch {
    return false;
  }
}
function candidate(value: Temporal.ZonedDateTime): TimeCandidate {
  return {
    epochMilliseconds: value.epochMilliseconds,
    instant: value.toInstant().toString(),
    offset: value.offset,
  };
}
export function resolveTime(
  draft: Draft,
  endpoint: "startTime" | "endTime",
): TimeResolution {
  const stamp = parseWallTime(draft[endpoint]);
  const failure = (status: TimeResolution["status"]): TimeResolution => ({
    status,
    candidates: [],
    selected: null,
  });
  if (stamp === null) return failure("invalid-date");
  if (!validZone(draft)) return failure("invalid-zone");
  if (!draft.timeInterpretation) {
    const minutes = fixedOffset(draft.timeZone)!;
    const epochMilliseconds = stamp - minutes * 60_000;
    const selected = {
      epochMilliseconds,
      instant: new Date(epochMilliseconds).toISOString(),
      offset: offsetLabel(minutes),
    };
    return { status: "valid", candidates: [selected], selected };
  }
  try {
    const local = Temporal.PlainDateTime.from(draft[endpoint]);
    const earlier = local.toZonedDateTime(draft.timeZone, {
      disambiguation: "earlier",
    });
    const later = local.toZonedDateTime(draft.timeZone, {
      disambiguation: "later",
    });
    // A gap shifts either candidate away from the requested wall clock. Reject both.
    if (
      !earlier.toPlainDateTime().equals(local) ||
      !later.toPlainDateTime().equals(local)
    )
      return failure("nonexistent");
    const candidates =
      earlier.epochMilliseconds === later.epochMilliseconds
        ? [candidate(earlier)]
        : [candidate(earlier), candidate(later)];
    const choice: Occurrence | undefined =
      endpoint === "startTime"
        ? draft.timeInterpretation.startOccurrence
        : draft.timeInterpretation.endOccurrence;
    if (candidates.length === 2 && !choice)
      return { status: "ambiguous", candidates, selected: null };
    return {
      status: "valid",
      candidates,
      selected: candidates[choice === "later" ? candidates.length - 1 : 0],
    };
  } catch {
    return failure("invalid-zone");
  }
}
export function timeProblem(result: TimeResolution): string {
  return {
    valid: "Resolved",
    "invalid-date": "Enter a valid calendar date and local time.",
    "invalid-zone":
      "Select a supported IANA zone or enter an explicit fixed UTC offset.",
    nonexistent:
      "This local time does not exist because the clocks move forward. Choose another time; no automatic shift was made.",
    ambiguous:
      "This local time occurs twice because the clocks move back. Explicitly select the earlier or later occurrence.",
  }[result.status];
}
export function formatDraftTime(
  draft: Draft,
  endpoint: "startTime" | "endTime",
): string {
  // Preserve legacy text byte-for-byte; validation still uses the explicit fixed offset.
  if (!draft.timeInterpretation) return formatWallTime(draft[endpoint]);
  const result = resolveTime(draft, endpoint);
  return result.selected
    ? `${formatWallTime(draft[endpoint])} (${draft.timeZone}, UTC${result.selected.offset})`
    : `[invalid: ${endpoint} — ${timeProblem(result)}]`;
}
