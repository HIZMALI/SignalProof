import { scenarios } from "../scenarios";
import { compareSnapshots } from "./comparison";
import { reviewApplicability, snapshotIssues } from "./review";
import { CHANNELS } from "./types";
import type { EvidenceSnapshot, EvidenceStore, ReviewRecord } from "./types";

export const REPORT_LIMITATIONS = [
  "Simulation only. Channel behavior and visibility are approximations, not proof of receipt or real-device accessibility.",
  "Facts, contacts, physical routes, supplied time zone offsets, identity and sender authority are not independently verified.",
  "Review completed — self-attested means recorded human acknowledgement, not a safety certification, factual guarantee or permission to send.",
  "No actual sending or delivery confirmation. Browser-local records can be edited or lost and are not an immutable external audit log.",
  "Timestamps use the local device clock. A local content fingerprint is not a digital signature or tamper-proof guarantee.",
  "Named zones use the runtime Intl time zone database via Temporal. Database versions are not exposed consistently; future rule/data updates can change recomputation. Recorded evidence is retained separately.",
];
export function reportData(
  snapshot: EvidenceSnapshot,
  reviews: ReviewRecord[],
  currentKey: string,
  comparison?: { before: EvidenceSnapshot; after: EvidenceSnapshot },
  fingerprint: string | null = null,
) {
  const ids = new Set([
    snapshot.id,
    ...(comparison ? [comparison.before.id, comparison.after.id] : []),
  ]);
  return {
    kind: "signalproof-report",
    version: 1,
    createdAt: new Date().toISOString(),
    clock: "local-device",
    fingerprint: fingerprint
      ? {
          algorithm: "SHA-256",
          value: fingerprint,
          meaning: "Local content fingerprint; not a signature",
        }
      : null,
    snapshot,
    reviews: reviews
      .filter((r) => ids.has(r.snapshotId))
      .map((r) => ({
        ...r,
        workingDraftApplicability: reviewApplicability(r, currentKey),
      })),
    comparison: comparison
      ? {
          ...comparison,
          differences: compareSnapshots(comparison.before, comparison.after),
        }
      : null,
    limitations: REPORT_LIMITATIONS,
  };
}
export function reportSummary(
  snapshot: EvidenceSnapshot,
  reviews: ReviewRecord[],
  currentKey: string,
  comparison?: { before: EvidenceSnapshot; after: EvidenceSnapshot },
): string {
  const review = reviews.find((r) => r.snapshotId === snapshot.id);
  const lines = [
    "SIGNALPROOF — REVIEW / EVIDENCE REPORT",
    snapshot.draft.title || "Untitled announcement",
    `Scenario: ${scenarios[snapshot.draft.scenario].label}`,
    `Snapshot: ${snapshot.id}`,
    `Recorded: ${snapshot.timestamp} (local device clock)`,
    `Ruleset: ${snapshot.rulesetVersion}`,
    `Origin: ${snapshot.origin === "demo" ? "Illustrative demo snapshot" : "Recorded working draft"}`,
    "",
    `Recorded source: ${snapshot.result.status}; ${snapshot.result.errorCount} errors; ${snapshot.result.warningCount} warnings; ${snapshot.result.passedCount} passed checks.`,
    `Required field completeness: ${snapshot.result.completeness}% (field presence only).`,
  ];
  for (const channel of CHANNELS) {
    const value = snapshot.channels[channel];
    lines.push(
      `${channel.toUpperCase()}: ${value.status}; ${value.errorCount} errors; ${value.warningCount} warnings; ${value.representedCount}/${value.coverage.length} required facts represented.`,
    );
    if (channel === "sms")
      lines.push(
        `SMS: ${value.metrics.sms!.encoding}; ${value.metrics.sms!.units} ${value.metrics.sms!.unitLabel}; ${value.metrics.sms!.segments} estimated standard-based segments.`,
      );
  }
  lines.push(
    "",
    ...(review
      ? [
          `Human review: ${review.status === "completed" ? "Review completed — self-attested" : "Recorded observations / review in progress"}.`,
          `Reviewer-provided name: ${review.name || "Not provided"}; role/team: ${review.role || "Not provided"}. Identity is unverified.`,
          `Review recorded: ${review.recordedAt} (local device clock).`,
          `Working draft applicability: ${reviewApplicability(review, currentKey)}.`,
          `Review notes (user-entered): ${review.notes || "None"}`,
          `Supporting reference (user-entered): ${review.evidenceNote || "None"}`,
        ]
      : ["Human review: Not reviewed."]),
  );
  if (comparison) {
    const delta = compareSnapshots(comparison.before, comparison.after);
    lines.push(
      "",
      `COMPARISON ${comparison.before.id} → ${comparison.after.id}`,
      `${delta.changedFields.length} source fields changed. ${delta.source.resolved.length} source issues resolved; ${delta.source.introduced.length} newly introduced; ${delta.source.unresolved.length} unresolved.`,
    );
    for (const change of delta.changedFields)
      lines.push(
        `${change.field}: ${change.before || "[empty]"} → ${change.after || "[empty]"}`,
      );
  }
  const issues = snapshotIssues(snapshot);
  if (issues.length)
    lines.push(
      "",
      "RECORDED OUTSTANDING FINDINGS",
      ...issues.map(
        (issue) =>
          `${issue.scope} / ${issue.id} [${issue.severity}]: ${issue.title}. ${issue.suggestion}`,
      ),
    );
  return [...lines, "", "LIMITATIONS", ...REPORT_LIMITATIONS].join("\n");
}
export function backupData(store: EvidenceStore): string {
  return JSON.stringify(store);
}
