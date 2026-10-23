import { createEmptyDraft } from "../domain/scenarios";
import type { AnnouncementFields, Draft, ScenarioId } from "../domain/types";
import { validInterpretation } from "../domain/timeZone";

export const LEGACY_STORAGE_KEY = "signalproof.draft.v1";
export const STORAGE_KEY = "signalproof.draft.v2";
const MAX_STORED_LENGTH = 200_000;

export type LoadResult = { draft: Draft | null; notice: string | null };

export function parseSavedDraft(raw: string): Draft | null {
  try {
    if (raw.length > MAX_STORED_LENGTH) return null;
    const data: unknown = JSON.parse(raw);
    if (
      !data ||
      typeof data !== "object" ||
      !("version" in data) ||
      ![1, 2].includes(Number(data.version)) ||
      typeof data.version !== "number" ||
      !("draft" in data)
    )
      return null;
    const candidate = data.draft;
    if (
      !candidate ||
      typeof candidate !== "object" ||
      !("scenario" in candidate) ||
      !["closure", "cancellation", "outage"].includes(
        String(candidate.scenario),
      )
    )
      return null;
    const draft = createEmptyDraft(candidate.scenario as ScenarioId);
    // A versioned schema prevents corrupt, partial or foreign data from entering the engine.
    for (const key of Object.keys(draft) as (
      keyof AnnouncementFields | "scenario"
    )[]) {
      if (!(key in candidate)) return null;
      const value: unknown = (candidate as Record<string, unknown>)[key];
      if (
        typeof value !== "string" ||
        value.length > (key === "body" ? 10_000 : 2_000)
      )
        return null;
      if (key !== "scenario") draft[key] = value;
    }
    if ("timeInterpretation" in candidate) {
      if (
        data.version !== 2 ||
        !validInterpretation(candidate.timeInterpretation)
      )
        return null;
      draft.timeInterpretation = { ...candidate.timeInterpretation };
    }
    return draft;
  } catch {
    return null;
  }
}

export function loadDraft(): LoadResult {
  try {
    const raw =
      window.localStorage.getItem(STORAGE_KEY) ??
      window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (raw === null) return { draft: null, notice: null };
    const draft = parseSavedDraft(raw);
    return {
      draft,
      notice: draft
        ? null
        : "The saved draft could not be read. A demo has been loaded instead.",
    };
  } catch {
    return {
      draft: null,
      notice:
        "Browser storage is unavailable. You can keep working, but your draft will not survive a reload.",
    };
  }
}

export function saveDraft(draft: Draft): boolean {
  try {
    const existing = window.localStorage.getItem(STORAGE_KEY);
    if (existing !== null && !parseSavedDraft(existing)) return false;
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 2, draft }),
    );
    return true;
  } catch {
    return false;
  }
}
