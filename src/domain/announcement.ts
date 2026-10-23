import type { Draft } from "./types";
import { formatDraftTime } from "./timeZone";
export { parseWallTime, formatWallTime } from "./wallTime";

function valueOrMissing(value: string): string {
  return value.trim() || "[not specified]";
}

export function generateAnnouncement(draft: Draft): string {
  const timeZone = valueOrMissing(draft.timeZone);
  const lines = [
    valueOrMissing(draft.title),
    "",
    `For: ${valueOrMissing(draft.audience)}`,
  ];

  if (draft.body.trim())
    lines.push(
      "",
      `Additional context (human review required): ${draft.body.trim()}`,
    );

  lines.push("");
  if (draft.scenario === "closure") {
    lines.push(`Closed entrance: ${valueOrMissing(draft.location)}`);
    lines.push(
      `Alternative entrance: ${valueOrMissing(draft.alternativeLocation)}`,
    );
    if (draft.accessibleRoute.trim())
      lines.push(`Accessible route: ${draft.accessibleRoute.trim()}`);
  }
  if (draft.scenario === "cancellation")
    lines.push(`Cancelled: ${valueOrMissing(draft.eventName)}`);
  if (draft.scenario === "outage")
    lines.push(`Unavailable service: ${valueOrMissing(draft.serviceName)}`);
  if (draft.scenario !== "closure" && draft.location.trim())
    lines.push(`Location / scope: ${draft.location.trim()}`);

  lines.push(
    `${draft.scenario === "cancellation" ? "Scheduled time" : "Effective from"}: ${formatDraftTime(draft, "startTime")}${draft.timeInterpretation ? "" : ` (${timeZone})`}`,
  );
  if (draft.endTime.trim())
    lines.push(
      `${draft.scenario === "outage" ? "Expected restoration" : "Ends"}: ${formatDraftTime(draft, "endTime")}${draft.timeInterpretation ? "" : ` (${timeZone})`}`,
    );
  if (draft.reason.trim()) lines.push(`Reason: ${draft.reason.trim()}`);
  if (draft.scenario === "outage" && draft.workaround.trim())
    lines.push(`Workaround: ${draft.workaround.trim()}`);
  lines.push(
    "",
    `What you need to do: ${valueOrMissing(draft.action)}`,
    "",
    `Contact / updates: ${valueOrMissing(draft.contact)}`,
  );
  return lines.join("\n");
}
