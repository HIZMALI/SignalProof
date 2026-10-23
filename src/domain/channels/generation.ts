import {
  formatDraftTime,
  resolveTime,
  validInterpretation,
  validZone,
} from "../timeZone";
import { createEmptyDraft } from "../scenarios";
import type { AnnouncementFields, Draft, FieldKey, ScenarioId } from "../types";
import { hasContactRoute, hasValue } from "../validation";
import { firstSmsSegment } from "./sms";
import type {
  ChannelOptions,
  ChannelPayload,
  ChannelType,
  MessagePart,
} from "./types";

export const DEFAULT_CHANNEL_OPTIONS: ChannelOptions = {
  smsCutoff: false,
  pushPreset: "compact",
  pushOrder: "action-first",
};

// Keep the persisted v1 schema unchanged; defensive handling also protects
// callers importing the pure functions from malformed runtime input.
export function normalizeChannelDraft(value: unknown): Draft {
  const candidate =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  if (
    !["closure", "cancellation", "outage"].includes(String(candidate.scenario))
  )
    return createEmptyDraft();
  const scenario: ScenarioId =
    candidate.scenario === "cancellation" || candidate.scenario === "outage"
      ? candidate.scenario
      : "closure";
  const draft = createEmptyDraft(scenario);
  for (const key of Object.keys(draft) as (
    keyof AnnouncementFields | "scenario"
  )[]) {
    if (key !== "scenario")
      draft[key] = typeof candidate[key] === "string" ? candidate[key] : "";
  }
  if (validInterpretation(candidate.timeInterpretation))
    draft.timeInterpretation = { ...candidate.timeInterpretation };
  else if (candidate.timeInterpretation !== undefined)
    return createEmptyDraft(scenario);
  return draft;
}

export function sourceFactState(
  draft: Draft,
  field: FieldKey,
): "valid" | "missing" | "invalid" {
  if (!hasValue(draft[field])) return "missing";
  if (
    (field === "startTime" || field === "endTime") &&
    resolveTime(draft, field).status !== "valid"
  )
    return "invalid";
  if (field === "contact" && !hasContactRoute(draft[field])) return "invalid";
  if (field === "timeZone" && !validZone(draft)) return "invalid";
  return "valid";
}

export function renderFact(draft: Draft, field: FieldKey): string {
  const state = sourceFactState(draft, field);
  if (state !== "valid")
    return `[${state === "missing" ? "missing" : "invalid"}: ${field}]`;
  if (field === "startTime" || field === "endTime")
    return formatDraftTime(draft, field);
  return draft[field].trim();
}

function compose(draft: Draft, rows: [string, FieldKey][]): MessagePart {
  const part: MessagePart = { text: "", references: [] };
  for (const [label, field] of rows) {
    if (part.text) part.text += "\n";
    part.text += label;
    const renderedValue = renderFact(draft, field);
    const start = part.text.length;
    part.text += renderedValue;
    // Placeholder text never earns semantic coverage.
    if (sourceFactState(draft, field) === "valid")
      part.references.push({
        field,
        sourceValue: draft[field].trim(),
        renderedValue,
        start,
        end: part.text.length,
      });
  }
  return part;
}

export function generateChannelPayload(
  input: unknown,
  channel: ChannelType,
  options: ChannelOptions = DEFAULT_CHANNEL_OPTIONS,
): ChannelPayload {
  const draft = normalizeChannelDraft(input);
  const subjectRows: [string, FieldKey][] = [["", "title"]];
  const action: [string, FieldKey] = ["Action: ", "action"];
  const details: [string, FieldKey][] =
    draft.scenario === "closure"
      ? [
          ["Closed: ", "location"],
          ["Use instead: ", "alternativeLocation"],
        ]
      : draft.scenario === "cancellation"
        ? [["Cancelled: ", "eventName"]]
        : [["Service unavailable: ", "serviceName"]];
  // Dates and zone remain separate referenced values, even when a template
  // reformats the original datetime-local input for people to read.
  const time: [string, FieldKey][] = [
    [draft.scenario === "cancellation" ? "Scheduled: " : "From: ", "startTime"],
    ["Time zone: ", "timeZone"],
  ];
  const optionalRows: [string, FieldKey][] = [];
  if (draft.scenario !== "closure" && draft.location.trim())
    optionalRows.push(["Location / scope: ", "location"]);
  if (draft.endTime.trim())
    optionalRows.push([
      draft.scenario === "outage" ? "Expected restoration: " : "Until: ",
      "endTime",
    ]);
  if (draft.scenario === "closure" && draft.accessibleRoute.trim())
    optionalRows.push(["Access: ", "accessibleRoute"]);
  if (draft.scenario === "outage" && draft.workaround.trim())
    optionalRows.push(["Workaround: ", "workaround"]);
  if (draft.reason.trim()) optionalRows.push(["Reason: ", "reason"]);
  const rows: [string, FieldKey][] =
    channel === "push" && options.pushOrder === "details-first"
      ? [...details, ...time, action]
      : [action, ...details, ...time];
  rows.push(["For: ", "audience"], ...optionalRows, [
    "Contact / updates: ",
    "contact",
  ]);
  if (channel === "sms") rows.unshift(...subjectRows);
  const body = compose(draft, rows);
  const payload: ChannelPayload = {
    channel,
    title:
      channel === "sms"
        ? { text: "", references: [] }
        : compose(draft, subjectRows),
    body,
  };
  if (channel === "sms" && options.smsCutoff) {
    // Explicit stress test only. References are retained with their original
    // offsets so coverage independently detects every clipped/omitted fact.
    return { ...payload, body: { ...body, text: firstSmsSegment(body.text) } };
  }
  return payload;
}
