import { describe, expect, it } from "vitest";
import { calculateSmsMetrics, firstSmsSegment } from "./sms";

describe("SMS encoding and standard segment budgets", () => {
  it("counts GSM basic letters, currency, Greek, and line breaks as one septet each", () => {
    const text = "Hello @£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ¡ÄÖÑÜ§¿äöñüà";
    const result = calculateSmsMetrics(text);
    expect(result.encoding).toBe("GSM-7");
    expect(result.units).toBe(text.length);
    expect(result.extensionCharacters).toBe(0);
  });
  it("counts every default extension character as two septets", () => {
    const result = calculateSmsMetrics("\f^{}\\[~]|€");
    expect(result.encoding).toBe("GSM-7");
    expect(result.characters).toBe(10);
    expect(result.units).toBe(20);
    expect(result.extensionCharacters).toBe(10);
  });
  it.each([
    [0, 0],
    [1, 1],
    [159, 1],
    [160, 1],
    [161, 2],
    [306, 2],
    [307, 3],
  ])("estimates %i GSM basic characters as %i segments", (length, segments) => {
    expect(calculateSmsMetrics("A".repeat(length)).segments).toBe(segments);
  });
  it.each([
    [69, 1],
    [70, 1],
    [71, 2],
    [134, 2],
    [135, 3],
  ])(
    "estimates %i BMP Unicode code units as %i segments",
    (length, segments) => {
      const result = calculateSmsMetrics("中".repeat(length));
      expect(result.units).toBe(length);
      expect(result.encoding).toBe("UCS-2 / UTF-16");
      expect(result.segments).toBe(segments);
    },
  );
  it("counts supplementary emoji as two code units and multi-code-point emoji honestly", () => {
    expect(calculateSmsMetrics("😀")).toMatchObject({
      characters: 1,
      units: 2,
    });
    expect(calculateSmsMetrics("👨‍👩‍👧‍👦")).toMatchObject({
      characters: 7,
      units: 11,
    });
    expect(calculateSmsMetrics("😀".repeat(35)).segments).toBe(1);
    expect(calculateSmsMetrics("😀".repeat(36)).segments).toBe(2);
  });
  it("never splits a surrogate pair at a multipart boundary", () => {
    expect(calculateSmsMetrics("😀".repeat(67)).segmentUnits).toEqual([
      66, 66, 2,
    ]);
  });
  it("never splits a GSM extension escape pair at a multipart boundary", () => {
    const result = calculateSmsMetrics("^".repeat(153));
    expect(result.units).toBe(306);
    expect(result.segmentUnits).toEqual([152, 152, 2]);
  });
  it("uses Unicode for the entire message when even one non-GSM character is present", () => {
    const result = calculateSmsMetrics("A".repeat(70) + "“");
    expect(result.units).toBe(71);
    expect(result.segments).toBe(2);
    expect(result.nonGsmCharacters).toEqual(["“"]);
    expect(calculateSmsMetrics("\u001b").encoding).toBe("UCS-2 / UTF-16");
  });
  it("does not transliterate user text or confuse all Latin letters with GSM", () => {
    expect(calculateSmsMetrics("é").encoding).toBe("GSM-7");
    expect(calculateSmsMetrics("á").encoding).toBe("UCS-2 / UTF-16");
  });
  it.each([undefined, null, 42, {}, []])(
    "handles malformed metric input %s",
    (value) => {
      expect(calculateSmsMetrics(value)).toMatchObject({
        units: 0,
        characters: 0,
        segments: 0,
      });
    },
  );
  it("leaves one-segment text intact and only cuts multipart text on request", () => {
    expect(firstSmsSegment("A".repeat(160))).toHaveLength(160);
    expect(firstSmsSegment("A".repeat(161))).toBe("A".repeat(153));
    expect(firstSmsSegment("😀".repeat(36))).toBe("😀".repeat(33));
    expect(firstSmsSegment("^".repeat(81))).toBe("^".repeat(76));
  });
});
