import type { SmsMetrics } from "./types";

// 3GPP TS 23.038, default alphabet and extension table. ESC is a table
// introducer, not a standalone printable character. National shift tables
// and provider-specific transliteration are deliberately not simulated.
const GSM_BASIC = new Set(
  Array.from(
    "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà",
  ),
);
const GSM_EXTENSION = new Set(Array.from("\f^{}\\[~]|€"));

function asText(value: unknown): string {
  return typeof value === "string" ? value : "";
}
export function gsmUnits(character: string): number | null {
  return GSM_BASIC.has(character) ? 1 : GSM_EXTENSION.has(character) ? 2 : null;
}

export function calculateSmsMetrics(value: unknown): SmsMetrics {
  const text = asText(value);
  const characters = Array.from(text);
  const nonGsm = characters.filter((character) => gsmUnits(character) === null);
  const unicode = nonGsm.length > 0;
  const weights = characters.map((character) =>
    unicode ? character.length : gsmUnits(character)!,
  );
  const units = weights.reduce((sum, weight) => sum + weight, 0);
  const singleSegmentLimit = unicode ? 70 : 160;
  const multipartSegmentLimit = unicode ? 67 : 153;
  const segmentUnits: number[] = [];
  if (units > 0 && units <= singleSegmentLimit) segmentUnits.push(units);
  else if (units > 0) {
    // Keep escape pairs and surrogate pairs together; ceil(units / capacity)
    // alone can undercount when a pair straddles a segment boundary.
    let current = 0;
    for (const weight of weights) {
      if (current + weight > multipartSegmentLimit) {
        segmentUnits.push(current);
        current = 0;
      }
      current += weight;
    }
    if (current) segmentUnits.push(current);
  }
  return {
    encoding: unicode ? "UCS-2 / UTF-16" : "GSM-7",
    characters: characters.length,
    units,
    unitLabel: unicode ? "UTF-16 code units" : "septets",
    extensionCharacters: characters.filter((character) =>
      GSM_EXTENSION.has(character),
    ).length,
    nonGsmCharacters: [...new Set(nonGsm)],
    singleSegmentLimit,
    multipartSegmentLimit,
    segments: segmentUnits.length,
    segmentUnits,
  };
}

export function firstSmsSegment(value: string): string {
  const metrics = calculateSmsMetrics(value);
  if (metrics.segments <= 1) return value;
  let units = 0;
  let result = "";
  for (const character of value) {
    const weight =
      metrics.encoding === "GSM-7" ? gsmUnits(character)! : character.length;
    if (units + weight > metrics.multipartSegmentLimit) break;
    result += character;
    units += weight;
  }
  return result;
}
