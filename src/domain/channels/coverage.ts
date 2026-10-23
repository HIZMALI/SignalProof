import { scenarios } from "../scenarios";
import type { Draft, FieldKey } from "../types";
import { renderFact, sourceFactState } from "./generation";
import type {
  ChannelPayload,
  ChannelPreview,
  FactReference,
  MessagePart,
  RequiredFactCoverage,
  VisibilityStatus,
} from "./types";

function isCurrentReference(
  draft: Draft,
  field: FieldKey,
  part: MessagePart,
  ref: FactReference,
): boolean {
  return (
    ref.field === field &&
    ref.sourceValue === draft[field].trim() &&
    ref.renderedValue === renderFact(draft, field) &&
    Number.isInteger(ref.start) &&
    Number.isInteger(ref.end) &&
    ref.start >= 0 &&
    ref.end > ref.start &&
    ref.end <= part.text.length &&
    part.text.slice(ref.start, ref.end) === ref.renderedValue
  );
}

export function verifyRequiredFactCoverage(
  draft: Draft,
  payload: ChannelPayload,
  preview: ChannelPreview,
): RequiredFactCoverage[] {
  const parts = [
    { part: payload.title, visibleEnd: preview.titleVisibleEnd },
    { part: payload.body, visibleEnd: preview.bodyVisibleEnd },
  ];
  return scenarios[draft.scenario].requiredFields.map((field) => {
    const source = sourceFactState(draft, field);
    if (source !== "valid")
      return {
        field,
        status: source === "missing" ? "source-missing" : "source-invalid",
        collapsedVisibility: "unavailable",
      };
    let represented = false;
    let visibility: VisibilityStatus = "hidden";
    for (const { part, visibleEnd } of parts) {
      for (const reference of part.references) {
        if (!isCurrentReference(draft, field, part, reference)) continue;
        represented = true;
        if (reference.end <= visibleEnd) visibility = "visible";
        else if (reference.start < visibleEnd && visibility !== "visible")
          visibility = "partial";
      }
    }
    return {
      field,
      status: represented ? "represented" : "omitted",
      collapsedVisibility: represented ? visibility : "unavailable",
    };
  });
}
