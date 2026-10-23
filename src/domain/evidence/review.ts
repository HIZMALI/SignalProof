import type { ChannelFinding } from "../channels/types";
import type { FieldKey } from "../types";
import { CHANNELS } from "./types";
import type {
  EvidenceSnapshot,
  ManualChecklistItem,
  ReviewForm,
  ReviewIssue,
  ReviewRecord,
} from "./types";
import { freezeEvidence, isCurrentEvaluation } from "./snapshot";
import { localId } from "../localId";

const CRITICAL_FIELDS: FieldKey[] = [
  "action",
  "startTime",
  "timeZone",
  "location",
  "alternativeLocation",
  "eventName",
  "serviceName",
];
export function warningPriority(field?: FieldKey): "critical" | "general" {
  return field && CRITICAL_FIELDS.includes(field) ? "critical" : "general";
}
export function manualChecklist(
  snapshot: EvidenceSnapshot,
): ManualChecklistItem[] {
  const items: ManualChecklistItem[] = [
    { id: "facts", label: "Announcement facts checked against a source." },
    { id: "time", label: "Effective date, time and time zone confirmed." },
    { id: "action", label: "Required action reviewed for clarity." },
    { id: "contact", label: "Contact or verification route manually checked." },
    { id: "audience", label: "Target audience reviewed." },
    ...(snapshot.draft.scenario === "closure"
      ? [
          {
            id: "access" as const,
            label: "Physical accessibility and alternative routes reviewed.",
          },
        ]
      : []),
    {
      id: "authority",
      label:
        "Sender authority or organizational authorization checked by a human.",
    },
    { id: "channels", label: "SMS, push and email representations inspected." },
  ];
  return items;
}
export function snapshotIssues(snapshot: EvidenceSnapshot): ReviewIssue[] {
  const source = snapshot.result.findings
    .filter((f) => f.status === "failed" && f.severity !== "informational")
    .map((f) => ({
      ...f,
      severity: f.severity as "error" | "warning",
      key: `source:${f.id}`,
      scope: "source" as const,
      priority: warningPriority(f.field),
    }));
  const channels = CHANNELS.flatMap((channel) =>
    snapshot.channels[channel].findings
      .filter((f) => f.status === "failed" && f.severity !== "informational")
      .map((f) => ({
        ...f,
        severity: f.severity as "error" | "warning",
        key: `${channel}:${f.id}`,
        scope: channel,
        priority: warningPriority(f.field),
      })),
  );
  return [...source, ...channels];
}
export function reviewBlockers(
  snapshot: EvidenceSnapshot,
  form: ReviewForm,
): string[] {
  const blockers: string[] = [];
  if (!isCurrentEvaluation(snapshot))
    blockers.push(
      "Record a new version under the current rules before completing a review.",
    );
  const errors = snapshotIssues(snapshot).filter(
    (issue) => issue.severity === "error",
  );
  if (errors.length)
    blockers.push(
      `${errors.length} unresolved source/channel errors block completion.`,
    );
  if (snapshot.options.smsCutoff)
    blockers.push(
      "Disable the artificial SMS cutoff and record a normal payload before completing review.",
    );
  if (!form.name.trim())
    blockers.push(
      "Enter the reviewer display name (self-provided, not identity-verified).",
    );
  if (manualChecklist(snapshot).some((item) => !form.checklist[item.id]))
    blockers.push("Complete every applicable manual checklist item.");
  const warnings = snapshotIssues(snapshot).filter(
    (issue) => issue.severity === "warning",
  );
  if (warnings.some((issue) => !form.acknowledgements[issue.key]?.acknowledged))
    blockers.push("Explicitly acknowledge every unresolved warning.");
  return blockers;
}
export function emptyReviewForm(): ReviewForm {
  return {
    name: "",
    role: "",
    notes: "",
    evidenceNote: "",
    checklist: {},
    acknowledgements: {},
  };
}
export function recordReview(
  snapshot: EvidenceSnapshot,
  form: ReviewForm,
  status: ReviewRecord["status"],
  metadata: { id?: string; timestamp?: string } = {},
): { record: ReviewRecord | null; blockers: string[] } {
  if (
    form.name.length > 120 ||
    form.role.length > 120 ||
    form.notes.length > 3000 ||
    form.evidenceNote.length > 2000 ||
    Object.values(form.acknowledgements).some((ack) => ack.note.length > 500)
  )
    return {
      record: null,
      blockers: ["Review text exceeds the documented length limits."],
    };
  const blockers = status === "completed" ? reviewBlockers(snapshot, form) : [];
  if (blockers.length) return { record: null, blockers };
  const checklist = Object.fromEntries(
    manualChecklist(snapshot).map((item) => [
      item.id,
      form.checklist[item.id] === true,
    ]),
  );
  const acknowledgements = Object.fromEntries(
    snapshotIssues(snapshot)
      .filter((issue) => issue.severity === "warning")
      .map((issue) => [
        issue.key,
        {
          acknowledged: form.acknowledgements[issue.key]?.acknowledged === true,
          note: form.acknowledgements[issue.key]?.note ?? "",
        },
      ]),
  );
  return {
    record: freezeEvidence({
      id: metadata.id ?? localId(),
      snapshotId: snapshot.id,
      contentKey: snapshot.contentKey,
      recordedAt: metadata.timestamp ?? new Date().toISOString(),
      status,
      name: form.name.trim(),
      role: form.role.trim(),
      notes: form.notes,
      evidenceNote: form.evidenceNote,
      checklist,
      acknowledgements,
    }),
    blockers: [],
  };
}
export function reviewApplicability(
  review: ReviewRecord,
  contentKey: string,
): "current" | "outdated" {
  return review.contentKey === contentKey ? "current" : "outdated";
}
export function groupVisibilityWarnings(findings: ChannelFinding[]): {
  critical: ChannelFinding[];
  general: ChannelFinding[];
  other: ChannelFinding[];
} {
  const visibility = findings.filter(
    (f) =>
      f.channel === "push" &&
      f.severity === "warning" &&
      f.status === "failed" &&
      /^CH-PUSH-00[56]/.test(f.id),
  );
  return {
    critical: visibility.filter((f) => warningPriority(f.field) === "critical"),
    general: visibility.filter((f) => warningPriority(f.field) === "general"),
    other: findings.filter((f) => !visibility.includes(f)),
  };
}
