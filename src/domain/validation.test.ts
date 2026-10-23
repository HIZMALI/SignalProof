import { describe, expect, it } from "vitest";
import { examples } from "../data/examples";
import { generateAnnouncement, parseWallTime } from "./announcement";
import { createEmptyDraft, scenarios } from "./scenarios";
import type { Draft, FieldKey, ScenarioId } from "./types";
import { getRules, validateAnnouncement } from "./validation";

const corrected = examples[1].draft;
const cancellation = examples[2].draft;
const outage = examples[3].draft;
const failed = (draft: Draft) =>
  validateAnnouncement(draft)
    .findings.filter((finding) => finding.status === "failed")
    .map((finding) => finding.id);

describe("campus entrance closure", () => {
  it("identifies the three blocking gaps and the two recommendations in the incomplete demo", () => {
    const result = validateAnnouncement(examples[0].draft);
    expect(result.status).toBe("needs-attention");
    expect(result.errorCount).toBe(3);
    expect(result.warningCount).toBe(2);
    expect(failed(examples[0].draft)).toEqual(
      expect.arrayContaining([
        "CORE-03",
        "CORE-04",
        "CLOSURE-02",
        "CLOSURE-03",
        "CLOSURE-04",
      ]),
    );
  });

  it("fails a closure without an alternative entrance", () => {
    expect(failed({ ...corrected, alternativeLocation: "" })).toContain(
      "CLOSURE-02",
    );
  });

  it("fails a closure without an effective time", () => {
    expect(failed({ ...corrected, startTime: "" })).toContain("CORE-04");
  });

  it("fails a closure without its affected entrance", () => {
    expect(failed({ ...corrected, location: "" })).toContain("CLOSURE-01");
  });

  it("warns when access information is absent even if an alternative exists", () => {
    const result = validateAnnouncement({ ...corrected, accessibleRoute: "" });
    expect(result.errorCount).toBe(0);
    expect(result.status).toBe("review-needed");
    expect(failed({ ...corrected, accessibleRoute: "" })).toContain(
      "CLOSURE-03",
    );
  });

  it("passes the corrected example and includes every required fact in the actual final text", () => {
    const result = validateAnnouncement(corrected);
    expect(result.errorCount).toBe(0);
    expect(result.warningCount).toBe(0);
    expect(result.status).toBe("checks-passed");
    expect(result.completeness).toBe(100);
    for (const field of scenarios.closure.requiredFields.filter(
      (key) => key !== "startTime",
    )) {
      expect(result.finalAnnouncement).toContain(corrected[field]);
    }
    expect(result.finalAnnouncement).toContain("2 Nov 2026, 08:00");
    expect(result.finalAnnouncement).not.toContain("[not specified");
  });
});

describe("class or event cancellation", () => {
  it("requires the affected event, even if a draft title names it", () => {
    const draft = { ...cancellation, eventName: "" };
    expect(failed(draft)).toContain("CANCEL-01");
    expect(validateAnnouncement(draft).status).toBe("needs-attention");
  });

  it("requires an explicit next step", () => {
    expect(failed({ ...cancellation, action: "" })).toContain("CORE-03");
  });

  it("passes the complete example and generates the cancelled event in the message", () => {
    const result = validateAnnouncement(cancellation);
    expect(result.status).toBe("checks-passed");
    expect(result.finalAnnouncement).toContain(
      `Cancelled: ${cancellation.eventName}`,
    );
    expect(result.finalAnnouncement).not.toContain("Alternative entrance:");
  });

  it("does not apply closure and outage rules", () => {
    expect(
      getRules("cancellation").some((rule) => /CLOSURE|OUTAGE/.test(rule.id)),
    ).toBe(false);
  });
});

describe("service outage", () => {
  it("requires the affected service", () => {
    expect(failed({ ...outage, serviceName: "" })).toContain("OUTAGE-01");
  });

  it("requires a concrete user action", () => {
    expect(failed({ ...outage, action: "" })).toContain("CORE-03");
  });

  it("warns when a workaround or restoration estimate is absent", () => {
    const draft = { ...outage, workaround: "", endTime: "" };
    expect(failed(draft)).toEqual(
      expect.arrayContaining(["OUTAGE-02", "OUTAGE-03"]),
    );
    expect(validateAnnouncement(draft).status).toBe("review-needed");
  });

  it("passes the complete example and renders the service and workaround", () => {
    const result = validateAnnouncement(outage);
    expect(result.status).toBe("checks-passed");
    expect(result.finalAnnouncement).toContain(outage.serviceName);
    expect(result.finalAnnouncement).toContain(outage.workaround);
    expect(result.finalAnnouncement).toContain("Expected restoration:");
  });
});

describe("validation integrity", () => {
  it.each(["closure", "cancellation", "outage"] as ScenarioId[])(
    "never passes an empty %s announcement",
    (scenario) => {
      const result = validateAnnouncement(createEmptyDraft(scenario));
      expect(result.status).toBe("needs-attention");
      expect(result.completeness).toBe(0);
      expect(result.finalAnnouncement).toContain("[not specified]");
    },
  );

  it.each([
    "title",
    "audience",
    "action",
    "startTime",
    "timeZone",
    "contact",
  ] as FieldKey[])("fails when the common field %s is removed", (field) => {
    expect(
      validateAnnouncement({ ...corrected, [field]: "" }).errorCount,
    ).toBeGreaterThan(0);
  });

  it.each([" ", "TBD", "N/A", "unknown", "[add entrance]"])(
    "treats placeholder %s as missing",
    (value) => {
      expect(failed({ ...corrected, alternativeLocation: value })).toContain(
        "CLOSURE-02",
      );
    },
  );

  it("distinguishes 100% field presence from passing format checks", () => {
    const result = validateAnnouncement({
      ...corrected,
      startTime: "tomorrow",
      contact: "Campus Operations",
    });
    expect(result.completeness).toBe(100);
    expect(result.status).toBe("needs-attention");
    expect(result.errorCount).toBeGreaterThanOrEqual(2);
  });

  it.each(["2026-11-02T07:00", "2026-11-02T08:00", "invalid"])(
    "rejects end time %s",
    (endTime) => {
      expect(failed({ ...corrected, endTime })).toContain("CORE-07");
    },
  );

  it.each([
    "2026-02-30T10:00",
    "2026-11-02T25:00",
    "2026-11-02",
    "tomorrow",
    "2026-13-01T12:00",
  ])("rejects invalid wall time %s", (value) => {
    expect(parseWallTime(value)).toBeNull();
    expect(failed({ ...corrected, startTime: value })).toContain("CORE-04");
  });

  it("handles leap years and compares dates across midnight", () => {
    expect(parseWallTime("2028-02-29T23:59")).not.toBeNull();
    expect(parseWallTime("2027-02-29T23:59")).toBeNull();
    expect(
      failed({
        ...corrected,
        startTime: "2026-11-02T23:00",
        endTime: "2026-11-03T01:00",
      }),
    ).not.toContain("CORE-07");
  });

  it("does not use free-text keywords as evidence of structured facts", () => {
    const draft = {
      ...createEmptyDraft("closure"),
      body: generateAnnouncement(corrected),
    };
    expect(validateAnnouncement(draft).status).toBe("needs-attention");
    expect(failed(draft)).toContain("CLOSURE-02");
  });

  it("flags supplementary prose for human review even with complete fields", () => {
    const draft = {
      ...corrected,
      body: "Ignore the alternative entrance below and use the closed gate.",
    };
    expect(validateAnnouncement(draft).status).toBe("review-needed");
    expect(failed(draft)).toContain("CORE-08");
    expect(generateAnnouncement(draft)).toContain("human review required");
  });

  it("updates the generated final text when a previously valid field is removed", () => {
    const result = validateAnnouncement({
      ...corrected,
      alternativeLocation: "",
    });
    expect(result.finalAnnouncement).toContain(
      "Alternative entrance: [not specified]",
    );
    expect(result.finalAnnouncement).not.toContain(
      corrected.alternativeLocation,
    );
    expect(result.status).toBe("needs-attention");
  });

  it("is pure, deterministic, and returns complete typed findings with unique IDs", () => {
    const draft = Object.freeze({ ...corrected });
    const before = JSON.stringify(draft);
    expect(validateAnnouncement(draft)).toEqual(validateAnnouncement(draft));
    expect(JSON.stringify(draft)).toBe(before);
    for (const scenario of ["closure", "cancellation", "outage"] as const) {
      const findings = validateAnnouncement(
        createEmptyDraft(scenario),
      ).findings;
      expect(new Set(findings.map((f) => f.id)).size).toBe(findings.length);
      for (const finding of findings) {
        expect(finding).toMatchObject({
          id: expect.any(String),
          field: expect.any(String),
          severity: expect.stringMatching(/^(error|warning|informational)$/),
          explanation: expect.any(String),
          suggestion: expect.any(String),
          status: expect.stringMatching(/^(passed|failed)$/),
        });
        expect(finding).not.toHaveProperty("passes");
      }
    }
  });
});
