import { describe, expect, it } from "vitest";
import { examples } from "../../data/examples";
import { scenarios } from "../scenarios";
import { analyzeChannel, analyzeChannelPayload } from "./analysis";
import { verifyRequiredFactCoverage } from "./coverage";
import {
  DEFAULT_CHANNEL_OPTIONS,
  generateChannelPayload,
  normalizeChannelDraft,
} from "./generation";
import { clipPreview, generateChannelPreview } from "./preview";
import type { ChannelType } from "./types";

const corrected = examples[1].draft;
const channels: ChannelType[] = ["sms", "push", "email"];

describe("deterministic, structured channel generation", () => {
  it.each(channels)(
    "represents every required fact for all scenarios in %s",
    (channel) => {
      for (const example of examples.slice(1)) {
        const result = analyzeChannel(example.draft, channel);
        expect(result.source.status).toBe("checks-passed");
        expect(result.errorCount).toBe(0);
        expect(result.coverage).toHaveLength(
          scenarios[example.draft.scenario].requiredFields.length,
        );
        expect(
          result.coverage.every((fact) => fact.status === "represented"),
        ).toBe(true);
      }
    },
  );
  it.each(channels)("never passes missing source facts in %s", (channel) => {
    const result = analyzeChannel(examples[0].draft, channel);
    expect(result.source).toMatchObject({ errorCount: 3, warningCount: 2 });
    expect(result.status).toBe("needs-attention");
    expect(result.overallStatus).toBe("needs-attention");
    expect(
      result.coverage
        .filter((fact) => fact.status === "source-missing")
        .map((fact) => fact.field),
    ).toEqual(
      expect.arrayContaining(["action", "startTime", "alternativeLocation"]),
    );
    expect(result.payload.body.text).toContain(
      "[missing: alternativeLocation]",
    );
  });
  it.each(channels)(
    "is deterministic and does not mutate the draft or options for %s",
    (channel) => {
      const draft = Object.freeze({ ...corrected });
      const options = Object.freeze({ ...DEFAULT_CHANNEL_OPTIONS });
      const before = JSON.stringify({ draft, options });
      expect(analyzeChannel(draft, channel, options)).toEqual(
        analyzeChannel(draft, channel, options),
      );
      expect(JSON.stringify({ draft, options })).toBe(before);
    },
  );
  it("tracks reformatted date facts without requiring raw ISO strings in the message", () => {
    const result = analyzeChannel(corrected, "sms");
    expect(result.payload.body.text).not.toContain(corrected.startTime);
    expect(result.payload.body.text).toContain("2 Nov 2026, 08:00");
    expect(
      result.coverage.find((fact) => fact.field === "startTime")?.status,
    ).toBe("represented");
    expect(result.payload.body.text).toContain(corrected.timeZone);
  });
  it("does not infer semantic coverage from an unreferenced keyword match", () => {
    const payload = generateChannelPayload(corrected, "email");
    payload.body.references = payload.body.references.filter(
      (reference) => reference.field !== "action",
    );
    expect(payload.body.text).toContain(corrected.action);
    const result = analyzeChannelPayload(corrected, payload);
    expect(
      result.coverage.find((fact) => fact.field === "action")?.status,
    ).toBe("omitted");
    expect(
      result.findings.find((finding) => finding.id === "CH-EMAIL-001-action")
        ?.status,
    ).toBe("failed");
  });
  it("rejects stale, forged, out-of-bounds, or changed references", () => {
    const payload = generateChannelPayload(corrected, "email");
    const action = payload.body.references.find(
      (reference) => reference.field === "action",
    )!;
    for (const changed of [
      { ...action, sourceValue: "different" },
      { ...action, start: -1 },
      { ...action, end: 999_999 },
      { ...action, renderedValue: "something else" },
      { ...action, end: action.end - 1 },
    ]) {
      const changedPayload = {
        ...payload,
        body: {
          ...payload.body,
          references: payload.body.references.map((reference) =>
            reference === action ? changed : reference,
          ),
        },
      };
      const coverage = verifyRequiredFactCoverage(
        corrected,
        changedPayload,
        generateChannelPreview(changedPayload),
      );
      expect(coverage.find((fact) => fact.field === "action")?.status).toBe(
        "omitted",
      );
    }
  });
  it("detects required content removed from a rendered payload even when references remain", () => {
    const payload = generateChannelPayload(corrected, "email");
    payload.body.text = payload.body.text.slice(0, 30);
    expect(
      analyzeChannelPayload(corrected, payload).errorCount,
    ).toBeGreaterThan(0);
  });
  it.each(["TBD", "N/A", "[enter route]", "   "])(
    "rejects placeholder source value %s",
    (value) => {
      const result = analyzeChannel(
        { ...corrected, alternativeLocation: value },
        "email",
      );
      expect(
        result.coverage.find((fact) => fact.field === "alternativeLocation")
          ?.status,
      ).toBe("source-missing");
      expect(result.status).toBe("needs-attention");
    },
  );
  it("marks invalid source time and contact separately from omission", () => {
    const result = analyzeChannel(
      { ...corrected, startTime: "2026-02-30T12:00", contact: "Someone" },
      "sms",
    );
    expect(
      result.coverage
        .filter((fact) => fact.status === "source-invalid")
        .map((fact) => fact.field),
    ).toEqual(expect.arrayContaining(["startTime", "contact"]));
  });
  it("keeps source validation and channel validation independent without overall approval", () => {
    const result = analyzeChannel(
      { ...corrected, endTime: "2026-11-02T07:00" },
      "email",
    );
    expect(result.source.status).toBe("needs-attention");
    expect(result.status).toBe("checks-passed");
    expect(result.overallStatus).toBe("needs-attention");
    const warningOnly = analyzeChannel(
      { ...corrected, accessibleRoute: "" },
      "email",
    );
    expect(warningOnly.status).toBe("checks-passed");
    expect(warningOnly.overallStatus).toBe("review-needed");
  });
  it("can flag SMS or push warnings even when the source passes", () => {
    for (const channel of ["sms", "push"] as const) {
      const result = analyzeChannel(corrected, channel);
      expect(result.source.status).toBe("checks-passed");
      expect(result.status).toBe("review-needed");
      expect(result.warningCount).toBeGreaterThan(0);
    }
  });
  it("only shortens SMS when the explicit loss test is enabled, then reports omitted facts", () => {
    const full = analyzeChannel(corrected, "sms");
    const cut = analyzeChannel(corrected, "sms", {
      ...DEFAULT_CHANNEL_OPTIONS,
      smsCutoff: true,
    });
    expect(full.representedCount).toBe(8);
    expect(cut.payload.body.text.length).toBeLessThan(
      full.payload.body.text.length,
    );
    expect(cut.coverage.some((fact) => fact.status === "omitted")).toBe(true);
    expect(cut.source.status).toBe("checks-passed");
    expect(cut.status).toBe("needs-attention");
    expect(
      cut.findings.find((finding) => finding.id === "CH-SMS-008")?.status,
    ).toBe("failed");
  });
  it("flags an excessive SMS using an explicit product threshold rather than a carrier limit", () => {
    const result = analyzeChannel(
      { ...corrected, reason: "A".repeat(2000) },
      "sms",
    );
    const finding = result.findings.find((item) => item.id === "CH-SMS-006")!;
    expect(finding.status).toBe("failed");
    expect(finding.explanation).toContain("not a carrier delivery limit");
  });
  it("keeps free-text context out of channels and explicitly discloses it", () => {
    const result = analyzeChannel(
      { ...corrected, body: "Contradictory prose not semantically checked" },
      "email",
    );
    expect(result.payload.body.text).not.toContain("Contradictory prose");
    expect(
      result.findings.find((finding) => finding.id === "CH-EMAIL-004")?.status,
    ).toBe("failed");
    expect(result.overallStatus).toBe("review-needed");
  });
  it.each([
    null,
    undefined,
    [],
    { scenario: "other" },
    { scenario: "outage", title: 123 },
    { ...corrected, action: null },
  ])("handles malformed source input %s without false approval", (input) => {
    for (const channel of channels) {
      expect(() => analyzeChannel(input, channel)).not.toThrow();
      expect(analyzeChannel(input, channel).overallStatus).toBe(
        "needs-attention",
      );
    }
  });
  it("preserves the current draft schema and relevant scenario fields", () => {
    expect(normalizeChannelDraft(corrected)).toEqual(corrected);
    expect(
      generateChannelPayload(examples[2].draft, "email").body.text,
    ).not.toContain("Use instead:");
    expect(
      generateChannelPayload(examples[3].draft, "email").body.text,
    ).toContain(examples[3].draft.workaround);
  });
  it("emits unique stable rule IDs and complete explainable finding data", () => {
    for (const channel of channels) {
      const findings = analyzeChannel(corrected, channel).findings;
      expect(new Set(findings.map((finding) => finding.id)).size).toBe(
        findings.length,
      );
      for (const finding of findings)
        expect(finding).toMatchObject({
          id: expect.stringMatching(/^CH-(SMS|PUSH|EMAIL)-\d{3}/),
          channel,
          severity: expect.stringMatching(/^(error|warning|informational)$/),
          status: expect.stringMatching(/^(passed|failed)$/),
          explanation: expect.any(String),
          suggestion: expect.any(String),
        });
    }
  });
});

describe("push and email content versus approximate visible content", () => {
  it("retains the full push payload while the collapsed card clips critical facts", () => {
    const result = analyzeChannel(corrected, "push");
    expect(result.preview.body).toContain("…");
    expect(result.payload.body.text).toContain(corrected.contact);
    expect(
      result.coverage.find((fact) => fact.field === "contact"),
    ).toMatchObject({ status: "represented", collapsedVisibility: "hidden" });
    expect(
      result.coverage.find((fact) => fact.field === "action")
        ?.collapsedVisibility,
    ).toBe("visible");
  });
  it("lets ordering and presets change visibility without changing source facts", () => {
    const compact = analyzeChannel(corrected, "push");
    const roomy = analyzeChannel(corrected, "push", {
      ...DEFAULT_CHANNEL_OPTIONS,
      pushPreset: "roomy",
    });
    const detailsFirst = analyzeChannel(corrected, "push", {
      ...DEFAULT_CHANNEL_OPTIONS,
      pushOrder: "details-first",
    });
    expect(roomy.preview.body.length).toBeGreaterThan(
      compact.preview.body.length,
    );
    expect(
      detailsFirst.coverage.find((fact) => fact.field === "action")
        ?.collapsedVisibility,
    ).toBe("hidden");
    expect(detailsFirst.representedCount).toBe(8);
    expect(compact.payload.body.text).toBe(roomy.payload.body.text);
  });
  it("never cuts a supplementary character in half in a visual preview", () => {
    expect(clipPreview("😀😀😀", 2)).toEqual({ text: "😀…", visibleEnd: 2 });
    expect(clipPreview("hi", 2)).toEqual({ text: "hi", visibleEnd: 2 });
    expect(clipPreview("hi", 0)).toEqual({ text: "", visibleEnd: 0 });
  });
  it("generates an email subject and an action-first body with offset, scope, and contact", () => {
    const result = analyzeChannel(corrected, "email");
    expect(result.payload.title.text).toBe(corrected.title);
    expect(
      result.payload.body.text.startsWith(`Action: ${corrected.action}`),
    ).toBe(true);
    expect(result.payload.body.text).toContain(corrected.timeZone);
    expect(result.payload.body.text).toContain(corrected.contact);
    expect(result.payload.body.text).toContain(corrected.alternativeLocation);
    expect(result.payload.body.text).not.toMatch(
      /verified sender|delivered|official approval/i,
    );
  });
  it("warns about subject clipping without silently removing the full subject", () => {
    const title = "Specific entrance closure " + "A".repeat(100);
    const result = analyzeChannel({ ...corrected, title }, "email");
    expect(result.payload.title.text).toBe(title);
    expect(result.preview.title.length).toBe(60);
    expect(
      result.findings.find((finding) => finding.id === "CH-EMAIL-005")?.status,
    ).toBe("failed");
  });
  it("catches a missing email subject even when the body has valid facts", () => {
    const payload = generateChannelPayload(corrected, "email");
    payload.title = { text: "", references: [] };
    const result = analyzeChannelPayload(corrected, payload);
    expect(
      result.findings.find((finding) => finding.id === "CH-EMAIL-003")?.status,
    ).toBe("failed");
    expect(result.errorCount).toBeGreaterThan(0);
  });
});
