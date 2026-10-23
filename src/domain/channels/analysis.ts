import { fieldLabels } from "../scenarios";
import type { Draft, FieldKey, Severity, ValidationStatus } from "../types";
import { validateAnnouncement } from "../validation";
import { verifyRequiredFactCoverage } from "./coverage";
import {
  DEFAULT_CHANNEL_OPTIONS,
  generateChannelPayload,
  normalizeChannelDraft,
} from "./generation";
import { calculateChannelMetrics, generateChannelPreview } from "./preview";
import type {
  ChannelAnalysisResult,
  ChannelFinding,
  ChannelOptions,
  ChannelPayload,
  ChannelType,
} from "./types";

function statusFor(errors: number, warnings: number): ValidationStatus {
  return errors
    ? "needs-attention"
    : warnings
      ? "review-needed"
      : "checks-passed";
}

// Public analyzer accepts an existing payload as well: a renderer or deliberate
// shortening operation cannot claim coverage merely because source facts exist.
export function analyzeChannelPayload(
  input: unknown,
  payload: ChannelPayload,
  options: ChannelOptions = DEFAULT_CHANNEL_OPTIONS,
): ChannelAnalysisResult {
  const draft: Draft = normalizeChannelDraft(input);
  const source = validateAnnouncement(draft);
  const preview = generateChannelPreview(payload, options.pushPreset);
  const metrics = calculateChannelMetrics(payload);
  const coverage = verifyRequiredFactCoverage(draft, payload, preview);
  const channel = payload.channel;
  const prefix = `CH-${channel.toUpperCase()}`;
  const findings: ChannelFinding[] = [];
  function add(
    suffix: string,
    title: string,
    severity: Severity,
    passes: boolean,
    explanation: string,
    suggestion: string,
    field?: FieldKey,
  ) {
    findings.push({
      id: `${prefix}-${suffix}`,
      title,
      channel,
      severity,
      status: passes ? "passed" : "failed",
      explanation,
      suggestion,
      ...(field ? { field } : {}),
    });
  }
  for (const fact of coverage) {
    const label = fieldLabels[fact.field];
    const unavailable =
      fact.status === "source-missing" || fact.status === "source-invalid";
    add(
      `001-${fact.field}`,
      `${label}: ${fact.status === "represented" ? "represented" : unavailable ? "fix the source" : "omitted from payload"}`,
      "error",
      fact.status === "represented",
      unavailable
        ? `${label} is missing, a placeholder, or invalid in the source. A generated preview cannot repair it.`
        : `${label} must be represented by a complete, current semantic reference in the actual channel payload.`,
      unavailable
        ? `Edit ${label.toLowerCase()} in the announcement lab, then recheck this channel.`
        : `Restore the complete fact in the payload. Turn off a cutoff test or shorten the source wording without dropping essential information.`,
      fact.field,
    );
  }
  const placeholder =
    /\[(?:missing|invalid):[^\]]*\]/.test(
      payload.title.text + "\n" + payload.body.text,
    ) || /\b(?:TBD|TBC)\b/i.test(payload.title.text + "\n" + payload.body.text);
  add(
    "002",
    "No visible placeholders",
    "error",
    !placeholder,
    "Visible missing/invalid markers or TBD/TBC text need attention; placeholders never count as facts.",
    "Replace placeholders in the source fields; do not hide the marker in the channel template.",
  );
  add(
    "003",
    "Channel content is present",
    "error",
    !!payload.body.text.trim() &&
      (channel === "sms" || !!payload.title.text.trim()),
    "A channel needs message content; email requires a subject and push requires a title.",
    "Add a source title and required details, then regenerate the channel.",
    "title",
  );
  add(
    "004",
    "Additional context is excluded",
    "informational",
    !draft.body.trim(),
    "Free-text additional context is intentionally excluded from all channel templates. It is not treated as a structured fact.",
    "Review the source context yourself. Move essential details into the appropriate structured fields.",
    "body",
  );
  if (channel === "sms") {
    const sms = metrics.sms!;
    add(
      "005",
      "Multipart SMS",
      "warning",
      sms.segments <= 1,
      `The current text is estimated at ${sms.segments} SMS segments. Multipart messages are normally reassembled; they are not inherently truncated.`,
      "Review length and cost with your provider. Keep the critical facts; use another channel if needed.",
    );
    add(
      "006",
      "Long SMS review threshold",
      "warning",
      sms.segments <= 6,
      "This lab flags messages above 6 estimated segments for review. This is a product review threshold, not a carrier delivery limit.",
      "Tighten the wording in the source or choose email for the full detail. Do not remove required facts.",
    );
    add(
      "007",
      "Unicode encoding",
      "warning",
      sms.encoding === "GSM-7",
      "At least one non-GSM character switches the whole message to a Unicode estimate using UTF-16 code units. Emoji can consume two or more units.",
      "Inspect non-GSM characters and choose simpler punctuation only when meaning is preserved. No automatic substitutions are made.",
    );
    add(
      "008",
      "Artificial first-segment cutoff",
      "warning",
      !options.smsCutoff,
      "This is an intentional loss test, not normal multipart SMS behavior. Only the first transport segment is kept; later facts may be absent.",
      "Disable the cutoff to restore the full multipart payload. Inspect every omitted fact before using any shortened text.",
    );
  }
  if (channel === "push") {
    add(
      "005",
      "Collapsed card hides content",
      "warning",
      !preview.truncated,
      "The generic card uses a code-point budget to approximate visibility. Expanded payload content can be present even when it is not visible in the collapsed card.",
      "Inspect the expanded content and lead with the most urgent information. Device, font, settings, and OS behavior vary.",
    );
    for (const fact of coverage.filter(
      (fact) => fact.status === "represented",
    )) {
      add(
        `006-${fact.field}`,
        `${fieldLabels[fact.field]} ${fact.collapsedVisibility === "visible" ? "visible" : fact.collapsedVisibility === "partial" ? "partially visible" : "hidden"} in collapsed card`,
        "warning",
        fact.collapsedVisibility === "visible",
        "A complete fact in the full payload is not necessarily fully visible in the collapsed notification.",
        "Try a roomier generic preset or change the leading content. Verify how people can access full details on real devices.",
        fact.field,
      );
    }
  }
  if (channel === "email") {
    add(
      "005",
      "Inbox subject visibility",
      "warning",
      Array.from(payload.title.text).length <= 60,
      "The generic inbox clips subjects after a 60-code-point budget. This is a simulation, not an email client limit.",
      "Keep the subject concise and preserve the specific affected event, entrance, or service.",
      "title",
    );
    add(
      "006",
      "Inbox snippet is a sample",
      "informational",
      true,
      "The snippet shows the first 120 code points of the body; the full body is preserved. Actual clients may select a different snippet.",
      "Review the full body as well as the inbox view. No sender identity, receipt, or delivery status is verified.",
    );
  }
  const errorCount = findings.filter(
    (f) => f.status === "failed" && f.severity === "error",
  ).length;
  const warningCount = findings.filter(
    (f) => f.status === "failed" && f.severity === "warning",
  ).length;
  return {
    payload,
    preview,
    metrics,
    coverage,
    findings,
    errorCount,
    warningCount,
    representedCount: coverage.filter((f) => f.status === "represented").length,
    status: statusFor(errorCount, warningCount),
    overallStatus: statusFor(
      errorCount + source.errorCount,
      warningCount + source.warningCount,
    ),
    source,
  };
}

export function analyzeChannel(
  draft: unknown,
  channel: ChannelType,
  options: ChannelOptions = DEFAULT_CHANNEL_OPTIONS,
): ChannelAnalysisResult {
  return analyzeChannelPayload(
    draft,
    generateChannelPayload(draft, channel, options),
    options,
  );
}
