import { describe, expect, it } from "vitest";
import { examples } from "../data/examples";
import type { Draft } from "./types";
import {
  fixedOffset,
  formatDraftTime,
  resolveTime,
  validZone,
} from "./timeZone";
import { validateAnnouncement } from "./validation";
import { analyzeChannel } from "./channels/analysis";
import { createSnapshot } from "./evidence/snapshot";
import { compareSnapshots } from "./evidence/comparison";

const named = (zone: string, start: string, end = ""): Draft => ({
  ...examples[1].draft,
  timeZone: zone,
  timeInterpretation: { mode: "iana" },
  startTime: start,
  endTime: end,
});
describe("explicit IANA and fixed-offset interpretation", () => {
  it.each([
    ["Europe/Istanbul", "2026-01-15T12:00", "+03:00"],
    ["Europe/Istanbul", "2026-07-15T12:00", "+03:00"],
    ["Europe/London", "2026-01-15T12:00", "+00:00"],
    ["Europe/London", "2026-07-15T12:00", "+01:00"],
    ["America/New_York", "2026-07-15T12:00", "-04:00"],
    ["America/Los_Angeles", "2026-01-15T12:00", "-08:00"],
    ["Asia/Tokyo", "2026-07-15T12:00", "+09:00"],
  ])("resolves %s on %s as UTC%s", (zone, date, offset) => {
    const draft = named(zone, date);
    expect(resolveTime(draft, "startTime").selected?.offset).toBe(offset);
    expect(formatDraftTime(draft, "startTime")).toContain(`UTC${offset}`);
  });
  it.each([
    ["America/New_York", "2026-03-08T02:30"],
    ["Europe/London", "2026-03-29T01:30"],
    ["Australia/Lord_Howe", "2026-10-04T02:15"],
    ["Pacific/Apia", "2011-12-30T12:00"],
  ])("rejects nonexistent %s %s without shifting", (zone, time) => {
    const draft = named(zone, time);
    expect(resolveTime(draft, "startTime").status).toBe("nonexistent");
    expect(
      resolveTime(
        {
          ...draft,
          timeInterpretation: { mode: "iana", startOccurrence: "later" },
        },
        "startTime",
      ).selected,
    ).toBeNull();
    expect(
      validateAnnouncement(draft).findings.find((f) => f.id === "CORE-04")
        ?.status,
    ).toBe("failed");
    expect(
      analyzeChannel(draft, "email").coverage.find(
        (f) => f.field === "startTime",
      )?.status,
    ).toBe("source-invalid");
  });
  it.each([
    ["America/New_York", "2026-11-01T01:30", "-04:00", "-05:00"],
    ["Europe/London", "2026-10-25T01:30", "+01:00", "+00:00"],
    ["Australia/Lord_Howe", "2026-04-05T01:45", "+11:00", "+10:30"],
  ])(
    "requires an explicit occurrence for %s %s",
    (zone, time, earlier, later) => {
      const draft = named(zone, time);
      expect(resolveTime(draft, "startTime")).toMatchObject({
        status: "ambiguous",
        selected: null,
      });
      for (const [choice, offset] of [
        ["earlier", earlier],
        ["later", later],
      ] as const)
        expect(
          resolveTime(
            {
              ...draft,
              timeInterpretation: { mode: "iana", startOccurrence: choice },
            },
            "startTime",
          ).selected?.offset,
        ).toBe(offset);
    },
  );
  it("compares resolved instants across a fall transition even when wall clocks run backwards", () => {
    const draft = named(
      "America/New_York",
      "2026-11-01T01:50",
      "2026-11-01T01:10",
    );
    draft.timeInterpretation = {
      mode: "iana",
      startOccurrence: "earlier",
      endOccurrence: "later",
    };
    expect(validateAnnouncement(draft).errorCount).toBe(0);
    expect(
      resolveTime(draft, "endTime").selected!.epochMilliseconds -
        resolveTime(draft, "startTime").selected!.epochMilliseconds,
    ).toBe(20 * 60_000);
    expect(
      validateAnnouncement({
        ...draft,
        timeInterpretation: {
          mode: "iana",
          startOccurrence: "later",
          endOccurrence: "earlier",
        },
      }).findings.find((f) => f.id === "CORE-07")?.status,
    ).toBe("failed");
  });
  it("compares spring intervals, same instants, reversed and cross-midnight intervals", () => {
    const spring = named(
      "America/New_York",
      "2026-03-08T01:30",
      "2026-03-08T03:30",
    );
    expect(
      resolveTime(spring, "endTime").selected!.epochMilliseconds -
        resolveTime(spring, "startTime").selected!.epochMilliseconds,
    ).toBe(3_600_000);
    expect(validateAnnouncement(spring).errorCount).toBe(0);
    expect(
      validateAnnouncement({ ...spring, endTime: spring.startTime }).errorCount,
    ).toBe(1);
    expect(
      validateAnnouncement({ ...spring, endTime: "2026-03-08T01:00" })
        .errorCount,
    ).toBe(1);
    expect(
      validateAnnouncement(
        named("Asia/Tokyo", "2026-11-01T23:50", "2026-11-02T00:10"),
      ).errorCount,
    ).toBe(0);
  });
  it("rejects unsupported identifiers, offsets masquerading as named zones and invalid calendars", () => {
    expect(validZone(named("Europe/Not_A_Zone", "2026-01-01T10:00"))).toBe(
      false,
    );
    expect(validZone(named("+03:00", "2026-01-01T10:00"))).toBe(false);
    expect(
      resolveTime(named("Europe/London", "2026-02-30T10:00"), "startTime")
        .status,
    ).toBe("invalid-date");
    expect(fixedOffset("UTC+25:00")).toBeNull();
    expect(fixedOffset("UTC+03:99")).toBeNull();
    expect(fixedOffset("UTC+03")).toBeNull();
  });
  it("preserves legacy meaning, explicit offset, source counts and exact channel content", () => {
    const draft = {
      ...examples[1].draft,
      startTime: "2026-07-01T12:00",
      endTime: "2026-07-01T13:00",
    };
    expect(resolveTime(draft, "startTime").selected?.offset).toBe("+00:00");
    expect(resolveTime(draft, "startTime").selected?.instant).toBe(
      "2026-07-01T12:00:00.000Z",
    );
    expect(validateAnnouncement(examples[0].draft)).toMatchObject({
      errorCount: 3,
      warningCount: 2,
    });
    expect(validateAnnouncement(examples[1].draft)).toMatchObject({
      errorCount: 0,
      warningCount: 0,
      passedCount: 13,
    });
  });
  it("keeps final text and every channel consistent and binds occurrence choices to evidence", () => {
    const draft = named(
      "America/New_York",
      "2026-11-01T01:30",
      "2026-11-01T02:30",
    );
    draft.timeInterpretation!.startOccurrence = "later";
    const text = formatDraftTime(draft, "startTime");
    expect(validateAnnouncement(draft).finalAnnouncement).toContain(text);
    for (const channel of ["sms", "push", "email"] as const)
      expect(analyzeChannel(draft, channel).payload.body.text).toContain(text);
    const snapshot = createSnapshot(draft);
    const earlier = createSnapshot({
      ...draft,
      timeInterpretation: { mode: "iana", startOccurrence: "earlier" },
    });
    expect(snapshot.contentKey).not.toBe(earlier.contentKey);
    expect(
      compareSnapshots(snapshot, earlier).changedFields.find(
        (field) => field.field === "timeZone",
      ),
    ).toBeTruthy();
    expect(snapshot.assumptions.timeZoneData?.start?.offset).toBe("-05:00");
    expect(createSnapshot(draft).contentKey).toBe(snapshot.contentKey);
    const reordered = createSnapshot({
      ...draft,
      timeInterpretation: { startOccurrence: "later", mode: "iana" },
    });
    expect(reordered.contentKey).toBe(snapshot.contentKey);
    expect(compareSnapshots(snapshot, reordered).changedFields).toHaveLength(0);
    expect(Object.isFrozen(draft.timeInterpretation)).toBe(false);
    draft.timeInterpretation!.startOccurrence = "earlier";
    expect(snapshot.draft.timeInterpretation?.startOccurrence).toBe("later");
  });
});
