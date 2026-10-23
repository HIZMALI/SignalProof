import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Copy,
  Download,
  Info,
  Mail,
  MessageSquare,
  Radio,
} from "lucide-react";
import { useMemo } from "react";
import { analyzeChannel } from "../../domain/channels/analysis";
import type { ChannelLabProps, ChannelType } from "../../domain/channels/types";
import { copyText, downloadText } from "../../lib/export";
import { ChannelPreview } from "./ChannelPreview";
import { ChannelInspection } from "./ChannelInspection";

const channels = [
  {
    id: "sms",
    label: "SMS",
    icon: MessageSquare,
    subtitle: "Encoding & segments",
  },
  {
    id: "push",
    label: "Push notification",
    icon: Bell,
    subtitle: "What fits at a glance",
  },
  {
    id: "email",
    label: "Email",
    icon: Mail,
    subtitle: "Subject, snippet & body",
  },
] as const;
const sourceLabels = {
  "needs-attention": "Needs attention",
  "review-needed": "Review recommended",
  "checks-passed": "Applicable source checks passed",
};
const channelLabels = {
  "needs-attention": "Needs attention",
  "review-needed": "Review recommended",
  "checks-passed": "Applicable channel checks passed",
};

export function ChannelLab({
  draft,
  selected,
  options,
  onOptions: setOptions,
  onSelect,
  onEdit,
  onNotice,
}: ChannelLabProps) {
  const analyses = useMemo(
    () =>
      Object.fromEntries(
        channels.map((channel) => [
          channel.id,
          analyzeChannel(draft, channel.id, options),
        ]),
      ) as Record<ChannelType, ReturnType<typeof analyzeChannel>>,
    [draft, options],
  );
  const analysis = analyses[selected];
  const sms = analysis.metrics.sms;
  async function copy(part: "all" | "subject" | "body") {
    const content =
      part === "subject"
        ? analysis.payload.title.text
        : part === "body" || selected === "sms"
          ? analysis.payload.body.text
          : `${selected === "email" ? "Subject" : "Title"}: ${analysis.payload.title.text}\n\n${analysis.payload.body.text}`;
    const success = await copyText(content);
    onNotice(
      success
        ? `${selected === "email" && part === "subject" ? "Email subject" : selected === "email" && part === "body" ? "Email body" : "Channel payload"} copied. Human review is still required.`
        : "Clipboard access is unavailable. Select the generated text or download the channel payload instead.",
    );
  }
  return (
    <div className="channel-workspace">
      <div
        className="channel-source-strip"
        aria-label="Source announcement status"
      >
        <div>
          <span className="small-eyebrow">SOURCE ANNOUNCEMENT</span>
          <strong>{draft.title.trim() || "Untitled announcement"}</strong>
        </div>
        <div>
          <span className={`status-pill ${analysis.source.status}`}>
            {sourceLabels[analysis.source.status]}
          </span>
          <span className="source-counts">
            {analysis.source.errorCount} errors · {analysis.source.warningCount}{" "}
            warnings
          </span>
        </div>
        <button className="button button-secondary" onClick={() => onEdit()}>
          <ArrowLeft size={14} /> Edit source
        </button>
      </div>
      <div
        className="channel-picker"
        role="tablist"
        aria-label="Communication channel"
      >
        {channels.map(({ id, label, icon: Icon, subtitle }, index) => (
          <button
            key={id}
            id={`channel-tab-${id}`}
            role="tab"
            tabIndex={selected === id ? 0 : -1}
            aria-selected={selected === id}
            aria-controls="channel-tabpanel"
            onClick={() => onSelect(id)}
            onKeyDown={(e) => {
              if (["ArrowRight", "ArrowLeft", "Home", "End"].includes(e.key)) {
                e.preventDefault();
                const next =
                  e.key === "Home"
                    ? 0
                    : e.key === "End"
                      ? 2
                      : (index + (e.key === "ArrowRight" ? 1 : 2)) % 3;
                onSelect(channels[next].id);
                document
                  .getElementById(`channel-tab-${channels[next].id}`)
                  ?.focus();
              }
            }}
          >
            <span className="channel-picker-icon">
              <Icon size={19} />
            </span>
            <span>
              <strong>{label}</strong>
              <small>{subtitle}</small>
            </span>
            <i
              className={`channel-status-dot ${analyses[id].status}`}
              aria-label={channelLabels[analyses[id].status]}
            />
          </button>
        ))}
      </div>
      <div className="channel-summary" aria-live="polite" aria-atomic="true">
        <div>
          <span className="small-eyebrow">
            {selected.toUpperCase()} CHANNEL CHECKS
          </span>
          <h2 className={`channel-status-heading ${analysis.status}`}>
            {channelLabels[analysis.status]}
          </h2>
        </div>
        <div className="channel-summary-counts">
          <span>{analysis.errorCount} errors</span>
          <span>{analysis.warningCount} warnings</span>
          <span>
            {analysis.representedCount}/{analysis.coverage.length} required
            facts represented
          </span>
        </div>
      </div>
      <p className="channel-status-limit">
        Passing checks is not a safety certification, human approval, or proof
        of factual correctness.
      </p>
      {analysis.overallStatus !== "checks-passed" &&
        analysis.source.status !== "checks-passed" && (
          <div className="source-gate">
            <Info size={16} />
            <p>
              <strong>Source review still required.</strong> Channel checks do
              not override{" "}
              {analysis.source.errorCount ? "source errors" : "source warnings"}
              . Return to the announcement lab to resolve them.
            </p>
            <button onClick={() => onEdit()}>
              Review source <ArrowRight size={13} />
            </button>
          </div>
        )}
      <div
        className="channel-lab-grid"
        id="channel-tabpanel"
        role="tabpanel"
        aria-labelledby={`channel-tab-${selected}`}
      >
        <section
          className="panel channel-preview-panel"
          aria-label={`${selected.toUpperCase()} preview`}
        >
          <div className="channel-panel-heading">
            <h2>What your audience sees</h2>
            <span className="live-label">
              <i /> LOCAL LIVE{" "}
              <span className="sr-only">
                local recalculation, no delivery connection
              </span>
            </span>
          </div>
          <div className="channel-metrics">
            {sms ? (
              <>
                <div>
                  <span>ENCODING</span>
                  <strong>{sms.encoding}</strong>
                </div>
                <div>
                  <span>{sms.unitLabel.toUpperCase()}</span>
                  <strong>
                    {sms.units}
                    <small>{sms.characters} code points</small>
                  </strong>
                </div>
                <div>
                  <span>EST. SEGMENTS</span>
                  <strong>
                    {sms.segments}
                    <small>standard-based</small>
                  </strong>
                </div>
              </>
            ) : (
              <>
                <div>
                  <span>{selected === "email" ? "SUBJECT" : "TITLE"}</span>
                  <strong>
                    {analysis.metrics.titleCharacters}
                    <small>code points</small>
                  </strong>
                </div>
                <div>
                  <span>BODY</span>
                  <strong>
                    {analysis.metrics.bodyCharacters}
                    <small>code points</small>
                  </strong>
                </div>
                <div>
                  <span>
                    {selected === "push" ? "COLLAPSED CARD" : "INBOX SNIPPET"}
                  </span>
                  <strong className="metric-word">
                    {analysis.preview.truncated
                      ? "Partial view"
                      : "Fits budget"}
                  </strong>
                </div>
              </>
            )}
          </div>
          <div className="channel-preview-content">
            <ChannelPreview
              key={selected}
              analysis={analysis}
              options={options}
              onOptions={setOptions}
            />
            {sms && (
              <details className="sms-encoding-details">
                <summary>Inspect encoding assumptions</summary>
                <p>
                  GSM-7: 160 septets for a single segment, 153 per multipart
                  segment. Extension characters use two septets. Unicode: 70
                  UTF-16 code units for one segment, 67 for multipart. Surrogate
                  and escape pairs are kept together in this estimate.
                </p>
                <p>
                  {sms.nonGsmCharacters.length
                    ? `Non-GSM characters: ${sms.nonGsmCharacters
                        .slice(0, 8)
                        .map((c) => `“${c}”`)
                        .join(", ")}.`
                    : "All characters are in the GSM default or extension alphabet."}{" "}
                  {sms.extensionCharacters} GSM extension characters.
                </p>
                <p>
                  Segment units: {sms.segmentUnits.join(" + ") || "0"}. National
                  shift tables and provider smart encoding are not modeled.
                </p>
              </details>
            )}
          </div>
          <div className="channel-exportbar">
            {selected === "email" ? (
              <>
                <button
                  className="button button-primary"
                  onClick={() => copy("subject")}
                >
                  <Copy size={14} /> Copy subject
                </button>
                <button
                  className="button button-secondary"
                  onClick={() => copy("body")}
                >
                  <Copy size={14} /> Copy body
                </button>
              </>
            ) : (
              <button
                className="button button-primary"
                onClick={() => copy("all")}
              >
                <Copy size={14} /> Copy{" "}
                {selected === "sms" ? "SMS text" : "full push payload"}
              </button>
            )}
            <button
              className="button button-quiet"
              onClick={() => {
                const content =
                  selected === "sms"
                    ? analysis.payload.body.text
                    : `${selected === "email" ? "Subject" : "Title"}: ${analysis.payload.title.text}\n\n${analysis.payload.body.text}`;
                downloadText(content, `${draft.title}-${selected}`);
                onNotice(
                  "Channel payload downloaded. This does not send or approve a message.",
                );
              }}
            >
              <Download size={14} /> Download .txt
            </button>
          </div>
          <div className="channel-export-note">
            <Radio size={13} /> Simulation only. Copy/export never sends or
            approves a message.
          </div>
        </section>
        <ChannelInspection analysis={analysis} onEdit={onEdit} />
      </div>
      <div className="channel-limits">
        <Info size={16} />
        <p>
          Passing channel checks is{" "}
          <strong>
            not a safety certification, human approval, or proof of factual
            correctness
          </strong>
          . These simulations do not verify receipt, real-device accessibility,
          or institutional authorization. Source facts and time zone offsets
          require human verification.
        </p>
      </div>
    </div>
  );
}
