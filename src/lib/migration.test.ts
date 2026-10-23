import { describe, expect, it } from "vitest";
import fixture from "../test/fixtures/build03-evidence.json";
import { examples } from "../data/examples";
import {
  isCurrentEvaluation,
  createSnapshot,
  canonicalSerialize,
} from "../domain/evidence/snapshot";
import { reviewBlockers, emptyReviewForm } from "../domain/evidence/review";
import {
  LEGACY_STORAGE_KEY,
  STORAGE_KEY,
  loadDraft,
  parseSavedDraft,
  saveDraft,
} from "./storage";
import {
  appendSnapshot,
  HISTORY_KEY,
  LEGACY_HISTORY_KEY,
  loadEvidence,
  parseEvidence,
  saveEvidence,
} from "./evidenceStorage";

describe("validated v1 to v2 compatibility", () => {
  it("loads a legacy draft without assigning the device zone, writes v2 and retains the original v1 bytes", () => {
    const legacy = JSON.stringify({ version: 1, draft: examples[1].draft });
    localStorage.setItem(LEGACY_STORAGE_KEY, legacy);
    expect(loadDraft().draft).toEqual(examples[1].draft);
    const draft = {
      ...loadDraft().draft!,
      timeZone: "America/New_York",
      timeInterpretation: {
        mode: "iana" as const,
        startOccurrence: "later" as const,
      },
    };
    expect(saveDraft(draft)).toBe(true);
    expect(loadDraft().draft).toEqual(draft);
    expect(localStorage.getItem(LEGACY_STORAGE_KEY)).toBe(legacy);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).version).toBe(2);
  });
  it("strictly validates occurrence metadata and preserves an unknown active schema", () => {
    expect(
      parseSavedDraft(
        JSON.stringify({
          version: 2,
          draft: {
            ...examples[1].draft,
            timeInterpretation: { mode: "iana", startOccurrence: "automatic" },
          },
        }),
      ),
    ).toBeNull();
    localStorage.setItem(STORAGE_KEY, '{"version":999}');
    expect(saveDraft(examples[1].draft)).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('{"version":999}');
  });
  it("retains actual BUILD 03 snapshots, results, IDs, bindings and rules while writing a separate v2 store", () => {
    const raw = JSON.stringify(fixture);
    localStorage.setItem(LEGACY_HISTORY_KEY, raw);
    const loaded = loadEvidence();
    expect(loaded.warning).toBeNull();
    expect(loaded.data.version).toBe(2);
    expect(loaded.data.snapshots).toEqual(fixture.snapshots);
    expect(isCurrentEvaluation(loaded.data.snapshots[0])).toBe(false);
    expect(
      reviewBlockers(loaded.data.snapshots[0], emptyReviewForm()).join(" "),
    ).toContain("current rules");
    const updated = appendSnapshot(
      loaded.data,
      createSnapshot(examples[1].draft),
    );
    expect(saveEvidence(updated, loaded.data.revision).ok).toBe(true);
    expect(localStorage.getItem(LEGACY_HISTORY_KEY)).toBe(raw);
    expect(loadEvidence().data.snapshots.slice(1)).toEqual(fixture.snapshots);
    expect(
      parseEvidence(localStorage.getItem(HISTORY_KEY)!).data?.snapshots[0]
        .schemaVersion,
    ).toBe(2);
  });
  it("preserves historical completed self-attestations rather than reinterpreting them under new rules", () => {
    const snapshot = fixture.snapshots[0];
    const checklist = Object.fromEntries(
      [
        "facts",
        "time",
        "action",
        "contact",
        "audience",
        "access",
        "authority",
        "channels",
      ].map((id) => [id, true]),
    );
    const acknowledgements = Object.fromEntries(
      Object.entries(snapshot.channels).flatMap(([channel, value]) =>
        value.findings
          .filter((f) => f.status === "failed" && f.severity === "warning")
          .map((f) => [
            `${channel}:${f.id}`,
            {
              acknowledged: true,
              note: "Fictional compatibility fixture only.",
            },
          ]),
      ),
    );
    const review = {
      id: "historical-review",
      snapshotId: snapshot.id,
      contentKey: snapshot.contentKey,
      recordedAt: "2026-10-23T08:01:00.000Z",
      status: "completed",
      name: "Fictional legacy test reviewer",
      role: "",
      notes: "Test fixture; no real source verified.",
      evidenceNote: "",
      checklist,
      acknowledgements,
    };
    const parsed = parseEvidence(
      JSON.stringify({ ...fixture, reviews: [review] }),
    ).data!;
    expect(parsed.reviews[0]).toEqual(review);
    expect(parsed.snapshots[0].rulesetVersion).toBe(
      "source-1.0/channel-1.0/review-1.0",
    );
    expect(canonicalSerialize(parsed.snapshots[0])).toBe(
      canonicalSerialize(snapshot),
    );
    expect(createSnapshot(parsed.snapshots[0].draft).contentKey).not.toBe(
      review.contentKey,
    );
  });
});
