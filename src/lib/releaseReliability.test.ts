import { describe, expect, it, vi } from "vitest";
import { localId } from "../domain/localId";
import { examples } from "../data/examples";
import { createSnapshot, emptyEvidence } from "../domain/evidence/snapshot";
import { recordReview, emptyReviewForm } from "../domain/evidence/review";
import {
  appendReview,
  appendSnapshot,
  LEGACY_HISTORY_KEY,
  loadEvidence,
  saveEvidence,
} from "./evidenceStorage";
import { LEGACY_STORAGE_KEY, loadDraft } from "./storage";
import { validateAnnouncement } from "../domain/validation";

describe("release storage and runtime boundaries", () => {
  it("caps review count at 200 and rejects oversized persistence without weakening the separate size bound", () => {
    const snapshot = createSnapshot(examples[1].draft);
    let store = appendSnapshot(emptyEvidence(), snapshot);
    for (let i = 0; i < 200; i++)
      store = appendReview(
        store,
        recordReview(snapshot, emptyReviewForm(), "observations", {
          id: `review-limit-${i}`,
        }).record!,
      );
    expect(store.reviews).toHaveLength(200);
    expect(() =>
      appendReview(
        store,
        recordReview(snapshot, emptyReviewForm(), "observations").record!,
      ),
    ).toThrow("200-review limit");
    expect(saveEvidence(store, 0).reason).toBe("size");
    expect(loadEvidence().data.snapshots).toHaveLength(0);
  });
  it("preserves old free-text zones for correction rather than interpreting them using the device zone", () => {
    const draft = { ...examples[1].draft, timeZone: "London" };
    localStorage.setItem(
      LEGACY_STORAGE_KEY,
      JSON.stringify({ version: 1, draft }),
    );
    expect(loadDraft().draft?.timeZone).toBe("London");
    expect(loadDraft().draft?.timeInterpretation).toBeUndefined();
    expect(
      validateAnnouncement(loadDraft().draft!).findings.find(
        (f) => f.id === "CORE-05",
      )?.status,
    ).toBe("failed");
  });
  it("removes preserved v1 evidence only through the explicit force-clear operation", () => {
    localStorage.setItem(LEGACY_HISTORY_KEY, "{unreadable legacy}");
    expect(saveEvidence(emptyEvidence(), 0).reason).toBe("conflict");
    expect(localStorage.getItem(LEGACY_HISTORY_KEY)).toBe(
      "{unreadable legacy}",
    );
    expect(saveEvidence(emptyEvidence(), 0, true).ok).toBe(true);
    expect(localStorage.getItem(LEGACY_HISTORY_KEY)).toBeNull();
  });
  it("uses Web Crypto random bytes for record IDs when randomUUID is unavailable", () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, "crypto");
    const bytes = vi.fn((value: Uint8Array) => {
      for (let i = 0; i < value.length; i++) value[i] = i;
      return value;
    });
    try {
      Object.defineProperty(globalThis, "crypto", {
        configurable: true,
        value: { getRandomValues: bytes },
      });
      expect(localId()).toBe("00010203-0405-4607-8809-0a0b0c0d0e0f");
      expect(bytes).toHaveBeenCalledOnce();
    } finally {
      if (original) Object.defineProperty(globalThis, "crypto", original);
    }
  });
  it("handles maximum-length context and long structured values without executing markup or losing exact content", () => {
    const draft = {
      ...examples[1].draft,
      body: "<script>untrusted</script>".padEnd(10_000, "x"),
      title: "Long fictional title ".padEnd(2000, "x"),
      action: "Use the East Gate ".padEnd(2000, "x"),
    };
    const snapshot = createSnapshot(draft);
    expect(snapshot.result.finalAnnouncement).toContain(draft.body);
    expect(snapshot.channels.email.payload.body.text).toContain(draft.action);
    const store = appendSnapshot(emptyEvidence(), snapshot);
    expect(saveEvidence(store, 0).ok).toBe(true);
    expect(loadEvidence().data.snapshots[0].draft).toEqual(draft);
  });
});
