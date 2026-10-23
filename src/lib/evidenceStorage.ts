import { createEmptyDraft } from "../domain/scenarios";
import {
  canonicalSerialize,
  emptyEvidence,
  freezeEvidence,
  snapshotEvaluation,
} from "../domain/evidence/snapshot";
import { manualChecklist, snapshotIssues } from "../domain/evidence/review";
import { CHANNELS, MAX_REVIEWS, MAX_SNAPSHOTS } from "../domain/evidence/types";
import type {
  EvidenceSnapshot,
  EvidenceStore,
  ReviewRecord,
} from "../domain/evidence/types";
import { parseSavedDraft } from "./storage";

export const LEGACY_HISTORY_KEY = "signalproof.evidence.v1";
export const HISTORY_KEY = "signalproof.evidence.v2";
export const MAX_HISTORY_CHARS = 2_000_000;
export const MAX_RECORD_CHARS = 400_000;
export const MAX_BACKUP_BYTES = 4_000_000;
const fields = Object.keys(createEmptyDraft()).filter(
  (key) => key !== "scenario",
);
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const string = (v: unknown, max = 5000): v is string =>
  typeof v === "string" && v.length <= max;
const integer = (v: unknown, max = 1_000_000): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= max;
const oneOf = (v: unknown, values: readonly unknown[]): boolean =>
  values.includes(v);
const array = (
  v: unknown,
  max: number,
  guard: (value: unknown) => boolean,
): boolean => Array.isArray(v) && v.length <= max && v.every(guard);
const iso = (v: unknown): v is string =>
  string(v, 40) &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v) &&
  Number.isFinite(Date.parse(v)) &&
  new Date(v).toISOString() === v;
const id = (v: unknown): v is string =>
  string(v, 100) && /^[a-zA-Z0-9._:-]+$/.test(v);
const status = (v: unknown) =>
  oneOf(v, ["needs-attention", "review-needed", "checks-passed"]);
const statusFrom = (errors: number, warnings: number) =>
  errors ? "needs-attention" : warnings ? "review-needed" : "checks-passed";

function finding(v: unknown, channel = false): boolean {
  return (
    record(v) &&
    id(v.id) &&
    string(v.title, 300) &&
    oneOf(v.severity, ["error", "warning", "informational"]) &&
    oneOf(v.status, ["passed", "failed"]) &&
    string(v.explanation) &&
    string(v.suggestion) &&
    (channel
      ? oneOf(v.channel, CHANNELS) &&
        (v.field === undefined || oneOf(v.field, fields))
      : oneOf(v.field, fields))
  );
}
function counts(v: Record<string, unknown>): boolean {
  if (
    !Array.isArray(v.findings) ||
    !integer(v.errorCount, 100) ||
    !integer(v.warningCount, 100)
  )
    return false;
  const values = v.findings as Record<string, unknown>[];
  const errors = values.filter(
    (f) => f.status === "failed" && f.severity === "error",
  ).length;
  const warnings = values.filter(
    (f) => f.status === "failed" && f.severity === "warning",
  ).length;
  return (
    errors === v.errorCount &&
    warnings === v.warningCount &&
    v.status === statusFrom(errors, warnings)
  );
}
function sourceResult(v: unknown): boolean {
  return (
    record(v) &&
    array(v.findings, 64, (item) => finding(item)) &&
    counts(v) &&
    integer(v.passedCount, 64) &&
    v.passedCount ===
      (v.findings as Record<string, unknown>[]).filter(
        (f) => f.status === "passed",
      ).length &&
    integer(v.requiredFields, 16) &&
    v.requiredFields > 0 &&
    integer(v.completedFields, v.requiredFields) &&
    integer(v.completeness, 100) &&
    v.completeness ===
      Math.round((v.completedFields / v.requiredFields) * 100) &&
    string(v.finalAnnouncement, 50_000)
  );
}
function part(v: unknown): boolean {
  return (
    record(v) &&
    string(v.text, 50_000) &&
    array(
      v.references,
      32,
      (ref) =>
        record(ref) &&
        oneOf(ref.field, fields) &&
        string(ref.sourceValue, 10_000) &&
        string(ref.renderedValue, 10_000) &&
        integer(ref.start, 50_000) &&
        integer(ref.end, 50_000) &&
        ref.end > ref.start,
    )
  );
}
function channelResult(
  v: unknown,
  channel: string,
  source: Record<string, unknown>,
): boolean {
  if (
    !record(v) ||
    !record(v.payload) ||
    v.payload.channel !== channel ||
    !part(v.payload.title) ||
    !part(v.payload.body) ||
    !record(v.preview) ||
    !string(v.preview.title, 50_000) ||
    !string(v.preview.body, 50_000) ||
    !integer(v.preview.titleVisibleEnd, 50_000) ||
    !integer(v.preview.bodyVisibleEnd, 50_000) ||
    typeof v.preview.truncated !== "boolean"
  )
    return false;
  if (
    !record(v.metrics) ||
    !integer(v.metrics.titleCharacters, 50_000) ||
    !integer(v.metrics.bodyCharacters, 50_000) ||
    !array(
      v.coverage,
      16,
      (f) =>
        record(f) &&
        oneOf(f.field, fields) &&
        oneOf(f.status, [
          "represented",
          "source-missing",
          "source-invalid",
          "omitted",
        ]) &&
        oneOf(f.collapsedVisibility, [
          "visible",
          "partial",
          "hidden",
          "unavailable",
        ]),
    ) ||
    !array(
      v.findings,
      64,
      (f) => finding(f, true) && record(f) && f.channel === channel,
    ) ||
    !counts(v) ||
    !integer(v.representedCount, 16) ||
    v.representedCount !==
      (v.coverage as Record<string, unknown>[]).filter(
        (f) => f.status === "represented",
      ).length ||
    !status(v.overallStatus)
  )
    return false;
  if (
    v.overallStatus !==
    statusFrom(
      (v.errorCount as number) + (source.errorCount as number),
      (v.warningCount as number) + (source.warningCount as number),
    )
  )
    return false;
  if (channel === "sms") {
    const s = v.metrics.sms;
    if (
      !record(s) ||
      !oneOf(s.encoding, ["GSM-7", "UCS-2 / UTF-16"]) ||
      !integer(s.units) ||
      !integer(s.characters) ||
      !integer(s.extensionCharacters) ||
      !oneOf(s.unitLabel, ["septets", "UTF-16 code units"]) ||
      !array(s.nonGsmCharacters, 50_000, (c) => string(c, 2)) ||
      !integer(s.segments, 2000) ||
      !array(s.segmentUnits, 2000, (units) => integer(units, 160)) ||
      s.segments !== (s.segmentUnits as number[]).length ||
      s.units !== (s.segmentUnits as number[]).reduce((sum, n) => sum + n, 0) ||
      s.singleSegmentLimit !== (s.encoding === "GSM-7" ? 160 : 70) ||
      s.multipartSegmentLimit !== (s.encoding === "GSM-7" ? 153 : 67)
    )
      return false;
  }
  return true;
}
function validSnapshot(v: unknown): v is EvidenceSnapshot {
  if (
    !record(v) ||
    !oneOf(v.schemaVersion, [1, 2]) ||
    !id(v.id) ||
    !iso(v.timestamp) ||
    !string(v.rulesetVersion, 120) ||
    !oneOf(v.origin, ["recorded", "demo"]) ||
    !parseSavedDraft(
      JSON.stringify({ version: v.schemaVersion, draft: v.draft }),
    ) ||
    !sourceResult(v.result) ||
    !record(v.options) ||
    typeof v.options.smsCutoff !== "boolean" ||
    !oneOf(v.options.pushPreset, ["compact", "roomy"]) ||
    !oneOf(v.options.pushOrder, ["action-first", "details-first"])
  )
    return false;
  const a = v.assumptions;
  if (
    !record(a) ||
    !oneOf(a.templateVersion, ["2.0", "2.1"]) ||
    canonicalSerialize(a.smsSingle) !== "[160,70]" ||
    canonicalSerialize(a.smsMultipart) !== "[153,67]" ||
    a.pairPreservation !== true ||
    a.clock !== "local-device" ||
    !record(a.pushBudget) ||
    !integer(a.pushBudget.title, 1000) ||
    !integer(a.pushBudget.body, 10000) ||
    !record(a.emailBudget) ||
    a.emailBudget.title !== 60 ||
    a.emailBudget.body !== 120
  )
    return false;
  if (
    v.schemaVersion === 1 &&
    (a.templateVersion !== "2.0" || a.timeZoneData !== undefined)
  )
    return false;
  if (v.schemaVersion === 2) {
    const t = a.timeZoneData;
    const resolved = (value: unknown) =>
      value === null ||
      (record(value) &&
        string(value.instant, 50) &&
        Number.isFinite(Date.parse(value.instant)) &&
        string(value.offset, 12) &&
        /^[+-]\d{2}:\d{2}(?::\d{2})?$/.test(value.offset));
    if (
      a.templateVersion !== "2.1" ||
      !record(t) ||
      t.engine !== "Temporal-polyfill-0.5.1/runtime-Intl" ||
      !oneOf(t.mode, ["iana", "fixed"]) ||
      !record(v.draft) ||
      t.zone !== v.draft.timeZone ||
      t.mode !== (v.draft.timeInterpretation ? "iana" : "fixed") ||
      !resolved(t.start) ||
      !resolved(t.end)
    )
      return false;
  }
  if (
    !array(
      v.requiredFacts,
      16,
      (f) =>
        record(f) &&
        oneOf(f.field, fields) &&
        string(f.label, 200) &&
        string(f.value, 10_000) &&
        oneOf(f.state, ["valid", "missing", "invalid"]) &&
        record(v.draft) &&
        f.value === v.draft[f.field as string],
    ) ||
    !record(v.channels) ||
    !CHANNELS.every((channel) =>
      channelResult(
        (v.channels as Record<string, unknown>)[channel],
        channel,
        v.result as Record<string, unknown>,
      ),
    ) ||
    !string(v.contentKey, MAX_RECORD_CHARS)
  )
    return false;
  const snapshot = v as unknown as EvidenceSnapshot;
  if (
    snapshot.requiredFacts.length !== snapshot.result.requiredFields ||
    new Set(snapshot.requiredFacts.map((f) => f.field)).size !==
      snapshot.requiredFacts.length
  )
    return false;
  for (const channel of CHANNELS) {
    if (
      new Set(snapshot.channels[channel].findings.map((f) => f.id)).size !==
        snapshot.channels[channel].findings.length ||
      snapshot.channels[channel].coverage.length !==
        snapshot.requiredFacts.length ||
      new Set(snapshot.channels[channel].coverage.map((f) => f.field)).size !==
        snapshot.requiredFacts.length ||
      snapshot.channels[channel].coverage.some(
        (f) =>
          !snapshot.requiredFacts.some(
            (required) => required.field === f.field,
          ),
      )
    )
      return false;
  }
  return (
    new Set(snapshot.result.findings.map((f) => f.id)).size ===
      snapshot.result.findings.length &&
    snapshot.contentKey === canonicalSerialize(snapshotEvaluation(snapshot)) &&
    JSON.stringify(snapshot).length <= MAX_RECORD_CHARS
  );
}
function validReview(
  v: unknown,
  snapshots: EvidenceSnapshot[],
): v is ReviewRecord {
  if (
    !record(v) ||
    !id(v.id) ||
    !id(v.snapshotId) ||
    !iso(v.recordedAt) ||
    !oneOf(v.status, ["observations", "completed"]) ||
    !string(v.contentKey, MAX_RECORD_CHARS) ||
    !string(v.name, 120) ||
    !string(v.role, 120) ||
    !string(v.notes, 3000) ||
    !string(v.evidenceNote, 2000) ||
    !record(v.checklist) ||
    !Object.entries(v.checklist).every(
      ([key, value]) =>
        oneOf(key, [
          "facts",
          "time",
          "action",
          "contact",
          "audience",
          "access",
          "authority",
          "channels",
        ]) && typeof value === "boolean",
    ) ||
    !record(v.acknowledgements) ||
    Object.keys(v.acknowledgements).length > 64 ||
    !Object.entries(v.acknowledgements).every(
      ([key, ack]) =>
        /^(source|sms|push|email):[A-Za-z0-9_-]+$/.test(key) &&
        record(ack) &&
        typeof ack.acknowledged === "boolean" &&
        string(ack.note, 500),
    )
  )
    return false;
  const snapshot = snapshots.find((s) => s.id === v.snapshotId);
  if (!snapshot || snapshot.contentKey !== v.contentKey) return false;
  if (v.status === "completed") {
    const review = v as unknown as ReviewRecord;
    if (
      !review.name.trim() ||
      snapshot.options.smsCutoff ||
      snapshotIssues(snapshot).some((issue) => issue.severity === "error") ||
      manualChecklist(snapshot).some((item) => !review.checklist[item.id]) ||
      snapshotIssues(snapshot).some(
        (issue) =>
          issue.severity === "warning" &&
          !review.acknowledgements[issue.key]?.acknowledged,
      )
    )
      return false;
  }
  return true;
}

export function parseEvidence(raw: string): {
  data: EvidenceStore | null;
  error: string | null;
} {
  try {
    if (raw.length > MAX_HISTORY_CHARS)
      return {
        data: null,
        error: "Evidence exceeds the 2,000,000-character storage limit.",
      };
    const value: unknown = JSON.parse(raw);
    if (
      !record(value) ||
      value.kind !== "signalproof-evidence" ||
      !oneOf(value.version, [1, 2])
    )
      return {
        data: null,
        error:
          "Unknown or legacy evidence schema. Existing stored data was preserved.",
      };
    if (
      !integer(value.revision) ||
      !array(value.snapshots, MAX_SNAPSHOTS, validSnapshot) ||
      !Array.isArray(value.reviews) ||
      value.reviews.length > MAX_REVIEWS ||
      !value.reviews.every((review) =>
        validReview(review, value.snapshots as EvidenceSnapshot[]),
      )
    )
      return {
        data: null,
        error:
          "Evidence contains invalid or inconsistent nested records. Existing stored data was preserved.",
      };
    if (
      value.version === 1 &&
      (value.snapshots as EvidenceSnapshot[]).some(
        (snapshot) => snapshot.schemaVersion !== 1,
      )
    )
      return {
        data: null,
        error: "A legacy v1 store cannot contain v2 snapshots.",
      };
    if (
      new Set((value.snapshots as EvidenceSnapshot[]).map((s) => s.id)).size !==
        (value.snapshots as EvidenceSnapshot[]).length ||
      new Set((value.reviews as ReviewRecord[]).map((r) => r.id)).size !==
        value.reviews.length
    )
      return { data: null, error: "Duplicate record identifiers in evidence." };
    return {
      data: freezeEvidence({
        kind: "signalproof-evidence",
        version: 2,
        revision: value.revision,
        snapshots: value.snapshots as EvidenceSnapshot[],
        reviews: value.reviews as ReviewRecord[],
      }),
      error: null,
    };
  } catch {
    return {
      data: null,
      error:
        "Saved evidence is malformed or unreadable. Existing stored data was preserved.",
    };
  }
}
export function loadEvidence(): {
  data: EvidenceStore;
  warning: string | null;
  locked: boolean;
} {
  try {
    const raw =
      localStorage.getItem(HISTORY_KEY) ??
      localStorage.getItem(LEGACY_HISTORY_KEY);
    if (raw === null)
      return { data: emptyEvidence(), warning: null, locked: false };
    const parsed = parseEvidence(raw);
    return {
      data: parsed.data ?? emptyEvidence(),
      warning: parsed.error,
      locked: !parsed.data,
    };
  } catch {
    return {
      data: emptyEvidence(),
      warning:
        "History storage is unavailable. New records remain in memory; export a backup before leaving.",
      locked: false,
    };
  }
}
export function saveEvidence(
  data: EvidenceStore,
  expectedRevision: number,
  forceReplace = false,
): { ok: boolean; reason?: "size" | "conflict" | "storage"; warning?: string } {
  const raw = JSON.stringify(data);
  if (
    raw.length > MAX_HISTORY_CHARS ||
    data.snapshots.some(
      (snapshot) => JSON.stringify(snapshot).length > MAX_RECORD_CHARS,
    )
  )
    return {
      ok: false,
      reason: "size",
      warning:
        "History or snapshot is too large. Export a backup or shorten the draft before recording more.",
    };
  if (!parseEvidence(raw).data)
    return {
      ok: false,
      reason: "storage",
      warning:
        "Evidence is inconsistent and was not written. Existing storage was preserved.",
    };
  try {
    const existing =
      localStorage.getItem(HISTORY_KEY) ??
      (forceReplace ? null : localStorage.getItem(LEGACY_HISTORY_KEY));
    if (!forceReplace && existing !== null) {
      const parsed = parseEvidence(existing).data;
      if (!parsed || parsed.revision !== expectedRevision)
        return {
          ok: false,
          reason: "conflict",
          warning:
            "History changed or became unreadable. Existing storage was not overwritten. Export this tab's backup before reloading.",
        };
    }
    localStorage.setItem(HISTORY_KEY, raw);
    if (forceReplace) localStorage.removeItem(LEGACY_HISTORY_KEY);
    return { ok: true };
  } catch {
    return {
      ok: false,
      reason: "storage",
      warning:
        "History could not be saved on this device. Records remain in memory; export a backup before leaving.",
    };
  }
}
export function appendSnapshot(
  data: EvidenceStore,
  snapshot: EvidenceSnapshot,
): EvidenceStore {
  if (data.snapshots.some((s) => s.id === snapshot.id))
    throw new Error("Snapshot ID already exists.");
  const snapshots = [snapshot, ...data.snapshots].slice(0, MAX_SNAPSHOTS);
  return freezeEvidence({
    ...data,
    revision: data.revision + 1,
    snapshots,
    reviews: data.reviews.filter((r) =>
      snapshots.some((s) => s.id === r.snapshotId),
    ),
  });
}
export function appendReview(
  data: EvidenceStore,
  review: ReviewRecord,
): EvidenceStore {
  if (
    !data.snapshots.some(
      (s) => s.id === review.snapshotId && s.contentKey === review.contentKey,
    )
  )
    throw new Error("Review does not match a retained snapshot.");
  if (data.reviews.length >= MAX_REVIEWS)
    throw new Error(
      "The 200-review limit has been reached. Export a backup before clearing history.",
    );
  if (data.reviews.some((r) => r.id === review.id))
    throw new Error("Review ID already exists.");
  return freezeEvidence({
    ...data,
    revision: data.revision + 1,
    reviews: [review, ...data.reviews],
  });
}
export function mergeEvidence(
  existing: EvidenceStore,
  incoming: EvidenceStore,
): {
  data: EvidenceStore | null;
  error: string | null;
  added: number;
  duplicates: number;
} {
  for (const group of ["snapshots", "reviews"] as const) {
    for (const candidate of incoming[group]) {
      const duplicate = existing[group].find(
        (item) => item.id === candidate.id,
      );
      if (
        duplicate &&
        canonicalSerialize(duplicate) !== canonicalSerialize(candidate)
      )
        return {
          data: null,
          error: `Conflicting ${group} ID ${candidate.id}. Nothing was overwritten.`,
          added: 0,
          duplicates: 0,
        };
    }
  }
  const snapshots = incoming.snapshots.filter(
    (s) => !existing.snapshots.some((old) => old.id === s.id),
  );
  const reviews = incoming.reviews.filter(
    (r) => !existing.reviews.some((old) => old.id === r.id),
  );
  if (
    snapshots.length + existing.snapshots.length > MAX_SNAPSHOTS ||
    reviews.length + existing.reviews.length > MAX_REVIEWS
  )
    return {
      data: null,
      error:
        "Import would exceed the 50-snapshot/200-review limit. No existing records were removed.",
      added: 0,
      duplicates: 0,
    };
  const data = freezeEvidence({
    ...existing,
    revision: existing.revision + 1,
    snapshots: [...snapshots, ...existing.snapshots],
    reviews: [...reviews, ...existing.reviews],
  });
  if (JSON.stringify(data).length > MAX_HISTORY_CHARS)
    return {
      data: null,
      error: "Merged evidence would exceed the storage size limit.",
      added: 0,
      duplicates: 0,
    };
  return {
    data,
    error: null,
    added: snapshots.length + reviews.length,
    duplicates:
      incoming.snapshots.length +
      incoming.reviews.length -
      snapshots.length -
      reviews.length,
  };
}
