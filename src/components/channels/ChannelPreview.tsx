import {
  Bell,
  ChevronDown,
  ChevronUp,
  Mail,
  MessageSquare,
  Smartphone,
} from "lucide-react";
import { useState } from "react";
import { PUSH_PRESETS } from "../../domain/channels/preview";
import type {
  ChannelAnalysisResult,
  ChannelOptions,
} from "../../domain/channels/types";

interface Props {
  analysis: ChannelAnalysisResult;
  options: ChannelOptions;
  onOptions: (options: ChannelOptions) => void;
}

export function ChannelPreview({ analysis, options, onOptions }: Props) {
  const { payload, preview, metrics } = analysis;
  const [expanded, setExpanded] = useState(false);
  const [emailSize, setEmailSize] = useState<"desktop" | "mobile">("desktop");
  if (payload.channel === "sms")
    return (
      <>
        <div className="channel-controls">
          <label className="cutoff-toggle">
            <input
              type="checkbox"
              checked={options.smsCutoff}
              onChange={(e) =>
                onOptions({ ...options, smsCutoff: e.target.checked })
              }
            />
            <span>Stress test: first segment only</span>
          </label>
          <p>
            Artificial cutoff. Normal multipart SMS preserves the full message.
          </p>
        </div>
        {options.smsCutoff && (
          <div className="cutoff-notice">
            <strong>Intentional information loss test</strong>
            <p>
              This payload keeps only the first transport segment. Check which
              facts were cut; this is not normal multipart behavior.
            </p>
          </div>
        )}
        <div className="sms-device" aria-label="SMS device simulation">
          <div className="device-topline">
            <span>GENERIC MESSAGE VIEW</span>
            <Smartphone size={14} />
          </div>
          <div className="sms-conversation-heading">
            <span className="channel-avatar">
              <MessageSquare size={20} />
            </span>
            <strong>Announcement preview</strong>
            <span>Simulated SMS · no message sent</span>
          </div>
          <div className="sms-bubble" data-testid="sms-message">
            {payload.body.text}
          </div>
          <p className="device-caption">
            {metrics.sms!.segments} estimated{" "}
            {metrics.sms!.segments === 1 ? "segment" : "segments"} · shown as
            one reassembled message
          </p>
        </div>
        <p className="channel-approximation">
          Estimated standard-based segments. Carrier/provider limits and
          reassembly behavior can differ. No automatic shortening or character
          substitution.
        </p>
      </>
    );
  if (payload.channel === "push")
    return (
      <>
        <div className="channel-controls push-controls">
          <div className="form-field">
            <label htmlFor="push-preset">Generic card preset</label>
            <select
              id="push-preset"
              value={options.pushPreset}
              onChange={(e) =>
                onOptions({
                  ...options,
                  pushPreset: e.target.value as ChannelOptions["pushPreset"],
                })
              }
            >
              {Object.entries(PUSH_PRESETS).map(([id, preset]) => (
                <option key={id} value={id}>
                  {preset.label} · {preset.titleLimit}/{preset.bodyLimit}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="push-order">Lead the body with</label>
            <select
              id="push-order"
              value={options.pushOrder}
              onChange={(e) =>
                onOptions({
                  ...options,
                  pushOrder: e.target.value as ChannelOptions["pushOrder"],
                })
              }
            >
              <option value="action-first">Required action</option>
              <option value="details-first">Scenario details</option>
            </select>
          </div>
        </div>
        <div
          className="push-device"
          aria-label="Generic push device simulation"
        >
          <div className="device-topline">
            <span>GENERIC LOCK SCREEN</span>
            <Smartphone size={14} />
          </div>
          <div className="push-clock" aria-hidden="true">
            09:41<span>Your message, at a glance.</span>
          </div>
          <div className="push-card">
            <div className="push-app">
              <span>
                <Bell size={13} /> SIGNALPROOF PREVIEW
              </span>
              <span>SIMULATED</span>
            </div>
            <h3 data-testid="push-title">
              {expanded ? payload.title.text : preview.title}
            </h3>
            <p data-testid="push-body">
              {expanded ? payload.body.text : preview.body}
            </p>
            <button
              aria-expanded={expanded}
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? "Collapse notification" : "Expand full notification"}
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>
          <span className="push-caption">
            {expanded
              ? "Full generated payload"
              : `${PUSH_PRESETS[options.pushPreset].label} · approximate visible content`}
          </span>
        </div>
        <p className="channel-approximation">
          Generic budgets: {PUSH_PRESETS[options.pushPreset].titleLimit} title /{" "}
          {PUSH_PRESETS[options.pushPreset].bodyLimit} body code points,
          including ellipsis. These are lab presets, not OS limits or exact
          device rendering. Coverage always inspects the collapsed card
          separately.
        </p>
      </>
    );
  return (
    <>
      <div
        className="email-size-control"
        role="group"
        aria-label="Email preview width"
      >
        <span>Simulated viewport</span>
        <button
          aria-pressed={emailSize === "desktop"}
          onClick={() => setEmailSize("desktop")}
        >
          Desktop
        </button>
        <button
          aria-pressed={emailSize === "mobile"}
          onClick={() => setEmailSize("mobile")}
        >
          Mobile
        </button>
      </div>
      <div
        className={`email-device ${emailSize}`}
        aria-label="Email simulation"
      >
        <div className="email-inbox-header">
          <span>
            <Mail size={15} /> Inbox preview
          </span>
          <span>SIMULATED</span>
        </div>
        <div className="email-inbox-row">
          <span className="email-unread-dot" aria-hidden="true" />
          <div>
            <span className="unverified-sender">Sender not configured</span>
            <strong data-testid="email-inbox-subject">{preview.title}</strong>
            <p>{preview.body}</p>
          </div>
        </div>
        <div className="email-message">
          <p className="email-label">SUBJECT</p>
          <h3 data-testid="email-subject">{payload.title.text}</h3>
          <div className="email-source">
            From: not configured · To: audience field below
          </div>
          <div className="email-body" data-testid="email-body">
            {payload.body.text.split("\n").map((line, index) => (
              <p key={index} className={index === 0 ? "email-action" : ""}>
                {line}
              </p>
            ))}
          </div>
        </div>
      </div>
      <p className="channel-approximation">
        The inbox subject and snippet use generic visibility budgets; full
        subject and body are preserved below. No sender identity, delivery,
        receipt, or institutional authority is implied.
      </p>
    </>
  );
}
