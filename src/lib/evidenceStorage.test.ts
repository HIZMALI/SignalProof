import { describe, expect, it, vi } from "vitest";
import { examples } from "../data/examples";
import { DEFAULT_CHANNEL_OPTIONS } from "../domain/channels/generation";
import {
  appendReview,
  appendSnapshot,
  HISTORY_KEY,
  loadEvidence,
  MAX_HISTORY_CHARS,
  mergeEvidence,
  parseEvidence,
  saveEvidence,
} from "./evidenceStorage";
import {
  canonicalSerialize,
  createSnapshot,
  emptyEvidence,
  snapshotEvaluation,
} from "../domain/evidence/snapshot";
import { emptyReviewForm, recordReview } from "../domain/evidence/review";
import { STORAGE_KEY, saveDraft, loadDraft } from "./storage";

const snapshot = createSnapshot(examples[1].draft, DEFAULT_CHANNEL_OPTIONS, {
  id: "stored-snapshot",
});
const store = appendSnapshot(emptyEvidence(), snapshot);
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
describe("defensive persistent evidence", () => {
  it("round-trips immutable source, all channels and review observations across reload", () => {
    const review = recordReview(
      snapshot,
      { ...emptyReviewForm(), notes: "A retained observation." },
      "observations",
    ).record!;
    const withReview = appendReview(store, review);
    expect(saveEvidence(withReview, 0).ok).toBe(true);
    const reloaded = loadEvidence();
    expect(reloaded.data).toEqual(withReview);
    expect(reloaded.warning).toBeNull();
    expect(Object.isFrozen(reloaded.data.snapshots[0].channels.sms)).toBe(true);
  });
  it("does not touch draft.v1 while writing, loading or replacing history", () => {
    saveDraft(examples[0].draft);
    const raw = localStorage.getItem(STORAGE_KEY);
    saveEvidence(store, 0);
    loadEvidence();
    saveEvidence(emptyEvidence(), 1, true);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
    expect(loadDraft().draft).toEqual(examples[0].draft);
  });
  it("starts empty without inventing session-only BUILD 02 history", () => {
    expect(loadEvidence()).toEqual({
      data: emptyEvidence(),
      warning: null,
      locked: false,
    });
  });
  it.each([
    "{broken",
    "null",
    "[]",
    '{"version":0,"runs":[]}',
    '{"kind":"signalproof-evidence","version":999}',
  ])("preserves corrupt, legacy or unknown raw storage %s", (raw) => {
    localStorage.setItem(HISTORY_KEY, raw);
    expect(loadEvidence().locked).toBe(true);
    expect(loadEvidence().warning).toBeTruthy();
    expect(localStorage.getItem(HISTORY_KEY)).toBe(raw);
  });
  it("rejects oversized records and validates every nested channel, count, state and binding", () => {
    const mutations = [
      (data: typeof store) => {
        data.snapshots[0].channels.sms.metrics.sms!.segments = 999;
      },
      (data: typeof store) => {
        data.snapshots[0].result.errorCount = 3;
      },
      (data: typeof store) => {
        data.snapshots[0].draft.title = "x".repeat(2001);
      },
      (data: typeof store) => {
        data.snapshots[0].options.pushPreset = "unknown" as never;
      },
      (data: typeof store) => {
        data.snapshots[0].channels.email.coverage[0].status = "safe" as never;
      },
      (data: typeof store) => {
        data.snapshots[0].timestamp = "not-a-date";
      },
      (data: typeof store) => {
        data.snapshots[0].contentKey = "unbound";
      },
    ];
    for (const mutate of mutations) {
      const data = clone(store);
      mutate(data);
      expect(parseEvidence(JSON.stringify(data)).data).toBeNull();
    }
    expect(parseEvidence("x".repeat(MAX_HISTORY_CHARS + 1)).data).toBeNull();
  });
  it("accepts legitimate artificial-cutoff references extending beyond clipped text", () => {
    const cut = createSnapshot(examples[1].draft, {
      ...DEFAULT_CHANNEL_OPTIONS,
      smsCutoff: true,
    });
    expect(
      parseEvidence(JSON.stringify(appendSnapshot(emptyEvidence(), cut))).data,
    ).not.toBeNull();
  });
  it("preserves recorded results from an older ruleset without recomputing them", () => {
    const historical = clone(snapshot);
    historical.rulesetVersion = "historical-unknown";
    historical.contentKey = canonicalSerialize(snapshotEvaluation(historical));
    const parsed = parseEvidence(
      JSON.stringify(appendSnapshot(emptyEvidence(), historical)),
    ).data!;
    expect(parsed.snapshots[0].rulesetVersion).toBe("historical-unknown");
    expect(parsed.snapshots[0].result).toEqual(snapshot.result);
  });
  it("rejects reviews with wrong snapshot binding, invalid nested checklist or forged completion", () => {
    const review = recordReview(
      snapshot,
      emptyReviewForm(),
      "observations",
    ).record!;
    for (const patch of [
      { snapshotId: "missing" },
      { contentKey: "wrong" },
      { checklist: { facts: "yes" } },
      { status: "completed" },
    ]) {
      expect(
        parseEvidence(
          JSON.stringify({ ...store, reviews: [{ ...review, ...patch }] }),
        ).data,
      ).toBeNull();
    }
  });
  it("retains 50 newest immutable snapshots and only linked reviews", () => {
    let data = emptyEvidence();
    const first = createSnapshot(examples[0].draft, DEFAULT_CHANNEL_OPTIONS, {
      id: "first",
    });
    data = appendSnapshot(data, first);
    data = appendReview(
      data,
      recordReview(first, emptyReviewForm(), "observations").record!,
    );
    for (let i = 0; i < 50; i++)
      data = appendSnapshot(
        data,
        createSnapshot(examples[1].draft, DEFAULT_CHANNEL_OPTIONS, {
          id: `snapshot-${i}`,
        }),
      );
    expect(data.snapshots).toHaveLength(50);
    expect(data.snapshots[0].id).toBe("snapshot-49");
    expect(data.reviews).toHaveLength(0);
    expect(first.result.errorCount).toBe(3);
  });
  it("handles denied access and quota errors without deleting disk data or the draft", () => {
    saveDraft(examples[1].draft);
    saveEvidence(store, 0);
    const existing = localStorage.getItem(HISTORY_KEY);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Full", "QuotaExceededError");
    });
    expect(
      saveEvidence(
        appendSnapshot(store, createSnapshot(examples[2].draft)),
        store.revision,
      ).reason,
    ).toBe("storage");
    expect(localStorage.getItem(HISTORY_KEY)).toBe(existing);
    expect(loadDraft().draft).toEqual(examples[1].draft);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("Denied", "SecurityError");
    });
    expect(loadEvidence().warning).toContain("unavailable");
  });
  it("detects a conflicting storage revision instead of overwriting another tab", () => {
    saveEvidence(store, 0);
    const next = appendSnapshot(store, createSnapshot(examples[2].draft));
    expect(saveEvidence(next, 0).reason).toBe("conflict");
    expect(loadEvidence().data.snapshots).toHaveLength(1);
    expect(saveEvidence(next, 1).ok).toBe(true);
  });
  it("uses a single atomic history key with a parseable complete record", () => {
    const write = vi.spyOn(Storage.prototype, "setItem");
    saveEvidence(store, 0);
    expect(write).toHaveBeenCalledTimes(1);
    expect(write.mock.calls[0][0]).toBe(HISTORY_KEY);
    expect(
      parseEvidence(String(write.mock.calls[0][1])).data?.snapshots[0].id,
    ).toBe(snapshot.id);
  });
  it("rejects oversized or inconsistent new snapshots before writing over valid disk evidence", () => {
    saveEvidence(store, 0);
    const raw = localStorage.getItem(HISTORY_KEY);
    const oversized = clone(snapshot);
    oversized.contentKey = "x".repeat(400_001);
    expect(saveEvidence({ ...store, snapshots: [oversized] }, 1).reason).toBe(
      "size",
    );
    const inconsistent = clone(snapshot);
    inconsistent.channels.push.errorCount += 1;
    expect(saveEvidence({ ...store, snapshots: [inconsistent] }, 1).ok).toBe(
      false,
    );
    expect(localStorage.getItem(HISTORY_KEY)).toBe(raw);
  });
});
describe("safe evidence backup merge", () => {
  it("merges new records and skips identical duplicate IDs without mutating either input", () => {
    const next = appendSnapshot(
      store,
      createSnapshot(examples[2].draft, DEFAULT_CHANNEL_OPTIONS, {
        id: "new-record",
      }),
    );
    const merged = mergeEvidence(store, next);
    expect(merged.added).toBe(1);
    expect(merged.duplicates).toBe(1);
    expect(merged.data?.snapshots).toHaveLength(2);
    expect(store.snapshots).toHaveLength(1);
  });
  it("rejects conflicting IDs as a whole without overwriting existing evidence", () => {
    const conflict = appendSnapshot(
      emptyEvidence(),
      createSnapshot(examples[0].draft, DEFAULT_CHANNEL_OPTIONS, {
        id: snapshot.id,
      }),
    );
    expect(mergeEvidence(store, conflict).data).toBeNull();
    expect(store.snapshots[0].result.errorCount).toBe(0);
  });
  it("never evicts existing records to make room for an import", () => {
    const full = {
      ...emptyEvidence(),
      snapshots: Array.from({ length: 50 }, (_, i) =>
        createSnapshot(examples[0].draft, DEFAULT_CHANNEL_OPTIONS, {
          id: `existing-${i}`,
        }),
      ),
    };
    expect(mergeEvidence(full, store).error).toContain(
      "No existing records were removed",
    );
  });
});
