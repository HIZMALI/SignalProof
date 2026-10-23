import { describe, expect, it } from "vitest";
import { webcrypto } from "node:crypto";
import { examples } from "../../data/examples";
import { DEFAULT_CHANNEL_OPTIONS } from "../channels/generation";
import { compareSnapshots } from "./comparison";
import {
  backupData,
  reportData,
  reportSummary,
  REPORT_LIMITATIONS,
} from "./report";
import {
  emptyReviewForm,
  groupVisibilityWarnings,
  manualChecklist,
  recordReview,
  reviewApplicability,
  reviewBlockers,
  snapshotIssues,
} from "./review";
import {
  canonicalSerialize,
  createSnapshot,
  emptyEvidence,
  evaluateEvidence,
  localFingerprint,
  snapshotEvaluation,
} from "./snapshot";
import { CHANNELS } from "./types";

const incomplete = createSnapshot(examples[0].draft, DEFAULT_CHANNEL_OPTIONS, {
  id: "before",
  timestamp: "2026-10-23T08:00:00.000Z",
});
const complete = createSnapshot(examples[1].draft, DEFAULT_CHANNEL_OPTIONS, {
  id: "after",
  timestamp: "2026-10-23T08:01:00.000Z",
});
function responses(snapshot = complete) {
  const form = emptyReviewForm();
  form.name = "Illustrative test reviewer";
  form.notes = "Fictional example reviewed in an automated test.";
  for (const item of manualChecklist(snapshot)) form.checklist[item.id] = true;
  for (const issue of snapshotIssues(snapshot).filter(
    (f) => f.severity === "warning",
  ))
    form.acknowledgements[issue.key] = {
      acknowledged: true,
      note: "Acknowledged for this fictional test.",
    };
  return form;
}
describe("recorded evidence and canonical binding", () => {
  it("captures all three channels, assumptions, source rules and immutable values", () => {
    expect(complete.result).toMatchObject({
      errorCount: 0,
      warningCount: 0,
      passedCount: 13,
    });
    expect(Object.keys(complete.channels)).toEqual(CHANNELS);
    expect(complete.assumptions).toMatchObject({
      smsSingle: [160, 70],
      smsMultipart: [153, 67],
      clock: "local-device",
    });
    expect(complete.channels.sms.metrics.sms!.segments).toBeGreaterThan(1);
    expect(Object.isFrozen(complete.channels.push.coverage)).toBe(true);
    expect(() => {
      complete.draft.action = "mutated";
    }).toThrow();
  });
  it("uses sorted canonical object keys and excludes IDs, clocks, navigation and display expansion", () => {
    expect(canonicalSerialize({ z: 2, a: { y: true, x: "a" } })).toBe(
      canonicalSerialize({ a: { x: "a", y: true }, z: 2 }),
    );
    expect(
      createSnapshot(examples[1].draft, DEFAULT_CHANNEL_OPTIONS, {
        id: "another-id",
      }).contentKey,
    ).toBe(complete.contentKey);
    expect(canonicalSerialize(snapshotEvaluation(complete))).toBe(
      complete.contentKey,
    );
    expect(() => canonicalSerialize({ invalid: undefined })).toThrow();
  });
  it("does not mutate current draft or configuration references", () => {
    const draft = { ...examples[1].draft };
    const options = { ...DEFAULT_CHANNEL_OPTIONS };
    const snapshot = createSnapshot(draft, options);
    draft.action = "New action";
    options.pushPreset = "roomy";
    expect(snapshot.draft.action).toBe(examples[1].draft.action);
    expect(snapshot.options.pushPreset).toBe("compact");
  });
  it.each(["action", "startTime", "contact", "scenario"] as const)(
    "changes the binding when %s changes",
    (field) => {
      const draft = {
        ...complete.draft,
        [field]: field === "scenario" ? ("outage" as const) : "Changed",
      };
      expect(canonicalSerialize(evaluateEvidence(draft))).not.toBe(
        complete.contentKey,
      );
    },
  );
  it.each([
    { pushOrder: "details-first" as const },
    { pushPreset: "roomy" as const },
    { smsCutoff: true },
  ])("changes the binding for evaluation configuration %s", (patch) => {
    expect(
      canonicalSerialize(
        evaluateEvidence(complete.draft, {
          ...DEFAULT_CHANNEL_OPTIONS,
          ...patch,
        }),
      ),
    ).not.toBe(complete.contentKey);
  });
  it("binds the ruleset version and evaluation results", () => {
    expect(
      canonicalSerialize(
        evaluateEvidence(complete.draft, complete.options, "updated-rules"),
      ),
    ).not.toBe(complete.contentKey);
    const changed = JSON.parse(JSON.stringify(snapshotEvaluation(complete)));
    changed.channels.push.warningCount += 1;
    expect(canonicalSerialize(changed)).not.toBe(complete.contentKey);
  });
  it("uses real SHA-256 when Web Crypto is available and handles unavailable crypto", async () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, "crypto");
    try {
      Object.defineProperty(globalThis, "crypto", {
        configurable: true,
        value: webcrypto,
      });
      expect(await localFingerprint("abc")).toBe(
        "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
      );
      Object.defineProperty(globalThis, "crypto", {
        configurable: true,
        value: {},
      });
      expect(await localFingerprint("abc")).toBeNull();
    } finally {
      if (original) Object.defineProperty(globalThis, "crypto", original);
    }
  });
});
describe("comparison improvements and regressions", () => {
  it("calculates actual changed fields, resolved errors and coverage changes", () => {
    const diff = compareSnapshots(incomplete, complete);
    expect(diff.changedFields.map((f) => f.field)).toEqual(
      expect.arrayContaining(["action", "startTime", "alternativeLocation"]),
    );
    expect(
      diff.source.resolved.filter((f) => f.severity === "error"),
    ).toHaveLength(3);
    expect(diff.source.introduced).toHaveLength(0);
    expect(diff.completenessDelta).toBe(37);
    expect(
      diff.channels.email.coverageChanges.find(
        (change) => change.field === "action",
      )?.after?.status,
    ).toBe("represented");
  });
  it("shows regressions rather than assuming the selected after version is better", () => {
    const diff = compareSnapshots(complete, incomplete);
    expect(
      diff.source.introduced.filter((f) => f.severity === "error"),
    ).toHaveLength(3);
    expect(diff.source.resolved).toHaveLength(0);
    expect(diff.completenessDelta).toBe(-37);
  });
  it("reports no invented changes for the same snapshot", () => {
    const diff = compareSnapshots(complete, complete);
    expect(diff.sameSnapshot).toBe(true);
    expect(diff.changedFields).toHaveLength(0);
    expect(diff.source.introduced).toHaveLength(0);
    expect(diff.channels.push.unresolved.length).toBe(
      complete.channels.push.warningCount,
    );
  });
  it("compares different scenarios and does not treat inapplicable facts as present", () => {
    const cancellation = createSnapshot(examples[2].draft);
    const diff = compareSnapshots(complete, cancellation);
    expect(
      diff.changedFields.some((change) => change.field === "scenario"),
    ).toBe(true);
    expect(
      diff.channels.email.coverageChanges.find(
        (change) => change.field === "alternativeLocation",
      )?.after,
    ).toBeNull();
    expect(
      diff.channels.email.coverageChanges.find(
        (change) => change.field === "eventName",
      )?.before,
    ).toBeNull();
  });
  it("detects channel-only configuration changes while preserving identical source fields", () => {
    const cut = createSnapshot(complete.draft, {
      ...complete.options,
      smsCutoff: true,
    });
    const diff = compareSnapshots(complete, cut);
    expect(diff.changedFields).toHaveLength(0);
    expect(diff.source.introduced).toHaveLength(0);
    expect(
      diff.channels.sms.introduced.some(
        (finding) => finding.severity === "error",
      ),
    ).toBe(true);
  });
});
describe("manual review and invalidation", () => {
  it("requires every applicable checklist item and keeps access conditional", () => {
    expect(manualChecklist(complete)).toHaveLength(8);
    expect(
      manualChecklist(createSnapshot(examples[2].draft)).map((item) => item.id),
    ).not.toContain("access");
    const form = responses();
    form.checklist.authority = false;
    expect(recordReview(complete, form, "completed").record).toBeNull();
  });
  it("blocks completion but allows observations when source/channel errors remain", () => {
    const form = responses(incomplete);
    expect(
      recordReview(incomplete, form, "completed").blockers.join(" "),
    ).toContain("unresolved source/channel errors");
    expect(recordReview(incomplete, form, "observations").record?.status).toBe(
      "observations",
    );
  });
  it("blocks channel errors and artificial loss state despite a passing source", () => {
    const cut = createSnapshot(complete.draft, {
      ...complete.options,
      smsCutoff: true,
    });
    expect(cut.result.errorCount).toBe(0);
    expect(
      recordReview(cut, responses(cut), "completed").blockers.join(" "),
    ).toContain("artificial SMS cutoff");
  });
  it("requires every unresolved warning acknowledgement without erasing findings", () => {
    const form = responses();
    const warning = snapshotIssues(complete).find(
      (f) => f.severity === "warning",
    )!;
    form.acknowledgements[warning.key].acknowledged = false;
    expect(reviewBlockers(complete, form).join(" ")).toContain(
      "acknowledge every unresolved warning",
    );
    expect(complete.channels.push.warningCount).toBeGreaterThan(0);
  });
  it("records exact snapshot association, manual states, notes and device-clock timestamp", () => {
    const result = recordReview(
      complete,
      {
        ...responses(),
        role: "Test team",
        evidenceNote: "Fictional source note",
      },
      "completed",
      { id: "review-1", timestamp: "2026-10-23T09:00:00.000Z" },
    ).record!;
    expect(result).toMatchObject({
      snapshotId: complete.id,
      contentKey: complete.contentKey,
      recordedAt: "2026-10-23T09:00:00.000Z",
      status: "completed",
      role: "Test team",
      evidenceNote: "Fictional source note",
    });
    expect(Object.isFrozen(result.acknowledgements)).toBe(true);
  });
  it("preserves historical review while edits or relevant configurations invalidate applicability", () => {
    const review = recordReview(complete, responses(), "completed").record!;
    expect(reviewApplicability(review, complete.contentKey)).toBe("current");
    const changed = createSnapshot({
      ...complete.draft,
      action: "Use another route",
    });
    expect(reviewApplicability(review, changed.contentKey)).toBe("outdated");
    expect(
      reviewApplicability(
        review,
        createSnapshot(complete.draft, {
          ...complete.options,
          pushPreset: "roomy",
        }).contentKey,
      ),
    ).toBe("outdated");
    expect(review.status).toBe("completed");
    expect(review.snapshotId).toBe(complete.id);
  });
  it("does not invalidate on pure navigation, explanation expansion or re-recording identical content", () => {
    const review = recordReview(complete, responses(), "completed").record!;
    const same = createSnapshot(complete.draft, complete.options);
    expect(reviewApplicability(review, same.contentKey)).toBe("current");
  });
  it("prevents a historical ruleset from being silently completed under current rules", () => {
    const historical = { ...complete, rulesetVersion: "previous-rules" };
    historical.contentKey = canonicalSerialize(snapshotEvaluation(historical));
    expect(
      reviewBlockers(historical, responses(historical)).join(" "),
    ).toContain("current rules");
  });
  it("enforces review length limits and requires a self-provided name for completion", () => {
    expect(
      recordReview(complete, { ...responses(), name: " " }, "completed").record,
    ).toBeNull();
    expect(
      recordReview(
        complete,
        { ...responses(), notes: "x".repeat(3001) },
        "observations",
      ).record,
    ).toBeNull();
  });
  it("groups visibility warnings without hiding errors or altering underlying counts", () => {
    const findings = complete.channels.push.findings.filter(
      (f) => f.status === "failed",
    );
    const groups = groupVisibilityWarnings(findings);
    expect(
      groups.critical.length + groups.general.length + groups.other.length,
    ).toBe(findings.length);
    expect(
      groups.critical.every((f) =>
        [
          "startTime",
          "timeZone",
          "location",
          "alternativeLocation",
          "action",
        ].includes(f.field!),
      ),
    ).toBe(true);
    const missing = groupVisibilityWarnings(
      incomplete.channels.push.findings.filter((f) => f.status === "failed"),
    );
    expect(missing.other.some((finding) => finding.severity === "error")).toBe(
      true,
    );
  });
});
describe("portable reports and backup content", () => {
  it("exports the correct snapshot, reviews and actual comparison", () => {
    const review = recordReview(complete, responses(), "completed").record!;
    const report = reportData(complete, [review], incomplete.contentKey, {
      before: incomplete,
      after: complete,
    });
    expect(report.snapshot.id).toBe("after");
    expect(report.reviews[0].workingDraftApplicability).toBe("outdated");
    expect(
      report.comparison?.differences.source.resolved.filter(
        (f) => f.severity === "error",
      ),
    ).toHaveLength(3);
    expect(report.clock).toBe("local-device");
  });
  it("copies source/channel results and exact limitations without invented authorization", () => {
    const text = reportSummary(complete, [], complete.contentKey);
    expect(text).toContain("Snapshot: after");
    expect(text).toContain("Human review: Not reviewed");
    expect(text).toContain("estimated standard-based segments");
    expect(text).not.toContain("Safe to send");
    for (const limit of REPORT_LIMITATIONS) expect(text).toContain(limit);
  });
  it("treats user-entered markup as JSON/text rather than creating executable HTML", () => {
    const draft = {
      ...complete.draft,
      title: '<script>alert("test")</script>',
    };
    const snapshot = createSnapshot(draft);
    const report = JSON.parse(
      JSON.stringify(reportData(snapshot, [], snapshot.contentKey)),
    );
    expect(report.snapshot.draft.title).toBe(draft.title);
    expect(reportSummary(snapshot, [], snapshot.contentKey)).toContain(
      draft.title,
    );
  });
  it("backs up source and channel snapshots and review records using the evidence schema", () => {
    const store = {
      ...emptyEvidence(),
      snapshots: [complete],
      reviews: [recordReview(complete, responses(), "completed").record!],
    };
    expect(JSON.parse(backupData(store))).toEqual(store);
  });
});
