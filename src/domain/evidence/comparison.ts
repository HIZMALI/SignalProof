import { createEmptyDraft } from "../scenarios";
import type { AnnouncementFields, Draft } from "../types";
import { snapshotIssues } from "./review";
import { CHANNELS } from "./types";
import type { EvidenceSnapshot, ReviewIssue } from "./types";

export function diffIssues(before: ReviewIssue[], after: ReviewIssue[]) {
  const key = (issue: ReviewIssue) => `${issue.key}:${issue.severity}`;
  const beforeKeys = new Set(before.map(key));
  const afterKeys = new Set(after.map(key));
  return {
    resolved: before.filter((issue) => !afterKeys.has(key(issue))),
    introduced: after.filter((issue) => !beforeKeys.has(key(issue))),
    unresolved: after.filter((issue) => beforeKeys.has(key(issue))),
  };
}
export function compareSnapshots(
  before: EvidenceSnapshot,
  after: EvidenceSnapshot,
) {
  const beforeIssues = snapshotIssues(before);
  const afterIssues = snapshotIssues(after);
  const zoneText = (draft: Draft) =>
    draft.timeInterpretation
      ? `${draft.timeZone} · Named IANA · start occurrence: ${draft.timeInterpretation.startOccurrence ?? "not selected / not needed"} · end occurrence: ${draft.timeInterpretation.endOccurrence ?? "not selected / not needed"}`
      : draft.timeZone;
  const fields = Object.keys(createEmptyDraft()) as (
    keyof AnnouncementFields | "scenario"
  )[];
  const changedFields = fields
    .filter((field) =>
      field === "timeZone"
        ? zoneText(before.draft) !== zoneText(after.draft)
        : before.draft[field] !== after.draft[field],
    )
    .map((field) => ({
      field,
      before:
        field === "timeZone" ? zoneText(before.draft) : before.draft[field],
      after: field === "timeZone" ? zoneText(after.draft) : after.draft[field],
    }));
  return {
    beforeId: before.id,
    afterId: after.id,
    sameSnapshot: before.id === after.id,
    differentRules: before.rulesetVersion !== after.rulesetVersion,
    changedFields,
    completenessDelta: after.result.completeness - before.result.completeness,
    source: diffIssues(
      beforeIssues.filter((issue) => issue.scope === "source"),
      afterIssues.filter((issue) => issue.scope === "source"),
    ),
    channels: Object.fromEntries(
      CHANNELS.map((channel) => {
        const beforeFacts = before.channels[channel].coverage;
        const afterFacts = after.channels[channel].coverage;
        const factFields = [
          ...new Set([
            ...beforeFacts.map((fact) => fact.field),
            ...afterFacts.map((fact) => fact.field),
          ]),
        ];
        return [
          channel,
          {
            ...diffIssues(
              beforeIssues.filter((issue) => issue.scope === channel),
              afterIssues.filter((issue) => issue.scope === channel),
            ),
            coverageChanges: factFields
              .map((field) => ({
                field,
                before:
                  beforeFacts.find((fact) => fact.field === field) ?? null,
                after: afterFacts.find((fact) => fact.field === field) ?? null,
              }))
              .filter(
                (change) =>
                  change.before?.status !== change.after?.status ||
                  change.before?.collapsedVisibility !==
                    change.after?.collapsedVisibility,
              ),
          },
        ];
      }),
    ) as Record<
      (typeof CHANNELS)[number],
      ReturnType<typeof diffIssues> & {
        coverageChanges: {
          field: keyof AnnouncementFields;
          before:
            EvidenceSnapshot["channels"]["sms"]["coverage"][number] | null;
          after: EvidenceSnapshot["channels"]["sms"]["coverage"][number] | null;
        }[];
      }
    >,
  };
}
