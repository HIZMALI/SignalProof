import { describe, expect, it, vi } from "vitest";
import { examples } from "../data/examples";
import { loadDraft, parseSavedDraft, saveDraft, STORAGE_KEY } from "./storage";

const draft = examples[1].draft;
const encode = (value: unknown) => JSON.stringify({ version: 1, draft: value });

describe("local draft persistence", () => {
  it("round-trips all announcement fields", () => {
    expect(saveDraft(draft)).toBe(true);
    expect(loadDraft()).toEqual({ draft, notice: null });
  });

  it("starts clean when no saved draft exists", () => {
    expect(loadDraft()).toEqual({ draft: null, notice: null });
  });

  it.each(["{bad json", "null", "[]", "{}", '{"version":2,"draft":{}}'])(
    "recovers from malformed or unsupported storage %s",
    (raw) => {
      localStorage.setItem(STORAGE_KEY, raw);
      expect(loadDraft().draft).toBeNull();
      expect(loadDraft().notice).toBeTruthy();
    },
  );

  it("rejects foreign scenarios and incomplete or wrongly typed fields", () => {
    expect(
      parseSavedDraft(encode({ ...draft, scenario: "unknown" })),
    ).toBeNull();
    expect(parseSavedDraft(encode({ ...draft, action: 123 }))).toBeNull();
    const { title: _title, ...partial } = draft;
    expect(parseSavedDraft(encode(partial))).toBeNull();
  });

  it("rejects oversized input", () => {
    expect(parseSavedDraft("x".repeat(200_001))).toBeNull();
    expect(
      parseSavedDraft(encode({ ...draft, title: "x".repeat(2001) })),
    ).toBeNull();
  });

  it("ignores unexpected object keys", () => {
    expect(parseSavedDraft(encode({ ...draft, unrelated: "ignored" }))).toEqual(
      draft,
    );
  });

  it("handles blocked storage access without throwing", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("Blocked", "SecurityError");
    });
    expect(loadDraft()).toMatchObject({
      draft: null,
      notice: expect.stringContaining("unavailable"),
    });
  });

  it("reports quota failures instead of claiming the draft was saved", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Full", "QuotaExceededError");
    });
    expect(saveDraft(draft)).toBe(false);
  });
});
