import { analyzeChannel } from "../channels/analysis";
import {
  DEFAULT_CHANNEL_OPTIONS,
  sourceFactState,
} from "../channels/generation";
import { PUSH_PRESETS } from "../channels/preview";
import type { ChannelOptions } from "../channels/types";
import { fieldLabels, scenarios } from "../scenarios";
import type { Draft } from "../types";
import { validateAnnouncement } from "../validation";
import { resolveTime, TIME_ZONE_ENGINE } from "../timeZone";
import { localId } from "../localId";
import { CHANNELS, RULESET_VERSION } from "./types";
import type { Evaluation, EvidenceSnapshot, EvidenceStore } from "./types";

export function canonicalSerialize(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return JSON.stringify(value);
  if (typeof value === "number" && Number.isFinite(value))
    return JSON.stringify(value);
  if (Array.isArray(value))
    return `[${value.map(canonicalSerialize).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${canonicalSerialize((value as Record<string, unknown>)[key])}`,
      )
      .join(",")}}`;
  throw new Error("Canonical evidence must contain only finite JSON data.");
}
export function freezeEvidence<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freezeEvidence(child);
    Object.freeze(value);
  }
  return value;
}
export function emptyEvidence(): EvidenceStore {
  return {
    kind: "signalproof-evidence",
    version: 2,
    revision: 0,
    snapshots: [],
    reviews: [],
  };
}

export function evaluateEvidence(
  draft: Draft,
  options: ChannelOptions = DEFAULT_CHANNEL_OPTIONS,
  rulesetVersion = RULESET_VERSION,
): Evaluation {
  const channels = Object.fromEntries(
    CHANNELS.map((channel) => {
      const { source: _source, ...recorded } = analyzeChannel(
        draft,
        channel,
        options,
      );
      return [channel, recorded];
    }),
  ) as Evaluation["channels"];
  const budget = PUSH_PRESETS[options.pushPreset];
  return {
    draft: {
      ...draft,
      ...(draft.timeInterpretation
        ? { timeInterpretation: { ...draft.timeInterpretation } }
        : {}),
    },
    options: { ...options },
    rulesetVersion,
    result: validateAnnouncement(draft),
    channels,
    requiredFacts: scenarios[draft.scenario].requiredFields.map((field) => ({
      field,
      label: fieldLabels[field],
      value: draft[field],
      state: sourceFactState(draft, field),
    })),
    assumptions: {
      templateVersion: "2.1",
      timeZoneData: {
        engine: TIME_ZONE_ENGINE,
        mode: draft.timeInterpretation ? "iana" : "fixed",
        zone: draft.timeZone,
        start: resolveTime(draft, "startTime").selected && {
          instant: resolveTime(draft, "startTime").selected!.instant,
          offset: resolveTime(draft, "startTime").selected!.offset,
        },
        end: resolveTime(draft, "endTime").selected && {
          instant: resolveTime(draft, "endTime").selected!.instant,
          offset: resolveTime(draft, "endTime").selected!.offset,
        },
      },
      smsSingle: [160, 70],
      smsMultipart: [153, 67],
      pairPreservation: true,
      pushBudget: { title: budget.titleLimit, body: budget.bodyLimit },
      emailBudget: { title: 60, body: 120 },
      clock: "local-device",
    },
  };
}
export function snapshotEvaluation(snapshot: EvidenceSnapshot): Evaluation {
  const {
    draft,
    options,
    rulesetVersion,
    result,
    channels,
    requiredFacts,
    assumptions,
  } = snapshot;
  return {
    draft,
    options,
    rulesetVersion,
    result,
    channels,
    requiredFacts,
    assumptions,
  };
}
export function createSnapshot(
  draft: Draft,
  options: ChannelOptions = DEFAULT_CHANNEL_OPTIONS,
  metadata: {
    id?: string;
    timestamp?: string;
    origin?: EvidenceSnapshot["origin"];
  } = {},
): EvidenceSnapshot {
  const evaluation = evaluateEvidence(draft, options);
  return freezeEvidence({
    ...evaluation,
    schemaVersion: 2,
    id: metadata.id ?? localId(),
    timestamp: metadata.timestamp ?? new Date().toISOString(),
    origin: metadata.origin ?? "recorded",
    contentKey: canonicalSerialize(evaluation),
  });
}
export function isCurrentEvaluation(snapshot: EvidenceSnapshot): boolean {
  return (
    snapshot.rulesetVersion === RULESET_VERSION &&
    snapshot.contentKey ===
      canonicalSerialize(evaluateEvidence(snapshot.draft, snapshot.options))
  );
}
export async function localFingerprint(
  contentKey: string,
): Promise<string | null> {
  try {
    if (!crypto.subtle) return null;
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(contentKey),
    );
    return Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
  } catch {
    return null;
  }
}
