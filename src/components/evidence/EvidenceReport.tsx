import { Copy, Download, FileText, Printer } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { scenarios, fieldLabels } from "../../domain/scenarios";
import { compareSnapshots } from "../../domain/evidence/comparison";
import {
  manualChecklist,
  reviewApplicability,
} from "../../domain/evidence/review";
import {
  evaluateEvidence,
  isCurrentEvaluation,
  localFingerprint,
} from "../../domain/evidence/snapshot";
import {
  reportData,
  reportSummary,
  REPORT_LIMITATIONS,
} from "../../domain/evidence/report";
import { CHANNELS } from "../../domain/evidence/types";
import type {
  EvidenceSnapshot,
  ReviewRecord,
} from "../../domain/evidence/types";
import { copyText } from "../../lib/export";
import { downloadEvidence } from "../../lib/evidenceExport";
import { IssueList } from "./ComparisonView";

export function EvidenceReport({
  snapshot,
  reviews,
  currentKey,
  comparison,
  onNotice,
}: {
  snapshot: EvidenceSnapshot;
  reviews: ReviewRecord[];
  currentKey: string;
  comparison?: { before: EvidenceSnapshot; after: EvidenceSnapshot };
  onNotice: (message: string) => void;
}) {
  const [fingerprint, setFingerprint] = useState<string | null>(null);
  const [createdAt] = useState(() => new Date().toISOString());
  const recomputed = useMemo(
    () => evaluateEvidence(snapshot.draft, snapshot.options),
    [snapshot],
  );
  const records = reviews.filter((review) => review.snapshotId === snapshot.id);
  const diff = comparison
    ? compareSnapshots(comparison.before, comparison.after)
    : null;
  useEffect(() => {
    let active = true;
    setFingerprint(null);
    void localFingerprint(snapshot.contentKey).then((value) => {
      if (active) setFingerprint(value);
    });
    return () => {
      active = false;
    };
  }, [snapshot.contentKey]);
  useEffect(() => {
    let closed: HTMLDetailsElement[] = [];
    const beforePrint = () => {
      closed = Array.from(
        document.querySelectorAll<HTMLDetailsElement>(
          ".evidence-report details:not([open])",
        ),
      );
      closed.forEach((element) => {
        element.open = true;
      });
    };
    const afterPrint = () => {
      closed.forEach((element) => {
        element.open = false;
      });
      closed = [];
    };
    window.addEventListener("beforeprint", beforePrint);
    window.addEventListener("afterprint", afterPrint);
    return () => {
      window.removeEventListener("beforeprint", beforePrint);
      window.removeEventListener("afterprint", afterPrint);
    };
  }, []);
  return (
    <>
      <div className="report-toolbar screen-only">
        <div>
          <FileText size={18} />
          <span>Recorded evidence · printable and portable</span>
        </div>
        <div className="review-actions">
          <button
            className="button button-secondary"
            onClick={async () =>
              onNotice(
                (await copyText(
                  reportSummary(snapshot, reviews, currentKey, comparison),
                ))
                  ? "Evidence summary copied. This is local, unverified review evidence."
                  : "Clipboard unavailable. Download the JSON report or select the summary text instead.",
              )
            }
          >
            <Copy size={14} /> Copy summary
          </button>
          <button
            className="button button-secondary"
            onClick={() =>
              onNotice(
                downloadEvidence(
                  JSON.stringify(
                    reportData(
                      snapshot,
                      reviews,
                      currentKey,
                      comparison,
                      fingerprint,
                    ),
                    null,
                    2,
                  ),
                  `signalproof-report-${snapshot.id}.json`,
                )
                  ? "Evidence report JSON downloaded. Review data is not externally authenticated."
                  : "Download unavailable in this browser. Copy the summary instead.",
              )
            }
          >
            <Download size={14} /> Export report JSON
          </button>
          <button
            className="button button-primary"
            onClick={() => window.print()}
          >
            <Printer size={14} /> Print / Save as PDF
          </button>
        </div>
      </div>
      <article
        className="evidence-report"
        aria-label="Review and evidence report"
      >
        <header className="report-header">
          <span className="report-wordmark">
            SignalProof<span>.</span>
          </span>
          <span className="eyebrow">REVIEW / EVIDENCE REPORT</span>
          <h1>{snapshot.draft.title || "Untitled announcement"}</h1>
          <p>
            {scenarios[snapshot.draft.scenario].label} ·{" "}
            {snapshot.origin === "demo"
              ? "ILLUSTRATIVE DEMO SNAPSHOT"
              : "RECORDED WORKING DRAFT"}
          </p>
          <dl>
            <div>
              <dt>Snapshot</dt>
              <dd>{snapshot.id}</dd>
            </div>
            <div>
              <dt>Recorded</dt>
              <dd>{snapshot.timestamp} · local device clock</dd>
            </div>
            <div>
              <dt>Report created</dt>
              <dd>{createdAt} · local device clock</dd>
            </div>
            <div>
              <dt>Ruleset</dt>
              <dd>{snapshot.rulesetVersion}</dd>
            </div>
          </dl>
          <p className="report-disclaimer">
            Simulation only. This report is not a safety certification, verified
            identity, official approval, or automatic permission to send.
          </p>
        </header>
        <section className="report-section">
          <h2>01 / Recorded source validation</h2>
          <div className="report-time-interpretation">
            <h3>Recorded time interpretation</h3>
            {snapshot.assumptions.timeZoneData ? (
              <>
                <p>
                  {snapshot.assumptions.timeZoneData.mode === "iana"
                    ? "Named IANA zone"
                    : "Manual fixed offset"}
                  : {snapshot.assumptions.timeZoneData.zone}. Engine:{" "}
                  {snapshot.assumptions.timeZoneData.engine}. Runtime time zone
                  database version is unavailable.
                </p>
                {(["start", "end"] as const).map((endpoint) => (
                  <p key={endpoint}>
                    {endpoint === "start" ? "Start" : "End"}:{" "}
                    {snapshot.assumptions.timeZoneData![endpoint]
                      ? `${snapshot.assumptions.timeZoneData![endpoint]!.instant} · UTC${snapshot.assumptions.timeZoneData![endpoint]!.offset}`
                      : "Not resolved / not supplied in this recorded evaluation"}
                  </p>
                ))}
              </>
            ) : (
              <p>
                Legacy recorded evidence. Supplied wall clocks and zone labels
                are preserved; no IANA interpretation was retroactively applied.
              </p>
            )}
          </div>
          <p>
            {snapshot.result.status} · {snapshot.result.errorCount} errors ·{" "}
            {snapshot.result.warningCount} warnings ·{" "}
            {snapshot.result.passedCount} passed checks.
          </p>
          <p>
            Required field completeness:{" "}
            <strong>{snapshot.result.completeness}%</strong> · field presence
            only, not a safety score.
          </p>
          <div className="report-facts">
            {snapshot.requiredFacts.map((fact) => (
              <div key={fact.field}>
                <strong>{fact.label}</strong>
                <span>{fact.state}</span>
                <p>{fact.value || "[missing]"}</p>
              </div>
            ))}
          </div>
          <h3>Exact final announcement</h3>
          <pre className="recorded-payload">
            {snapshot.result.finalAnnouncement}
          </pre>
          <details>
            <summary>All recorded source findings and corrections</summary>
            {snapshot.result.findings.map((finding) => (
              <div className="report-finding" key={finding.id}>
                <strong>{finding.title}</strong>
                <code>
                  {finding.id} · {finding.severity} · {finding.status}
                </code>
                <p>{finding.explanation}</p>
                <p>Suggested correction: {finding.suggestion}</p>
              </div>
            ))}
          </details>
        </section>
        <section className="report-section">
          <h2>02 / Recorded channel simulations</h2>
          <p>
            Assumptions: template {snapshot.assumptions.templateVersion}; SMS
            160/153 GSM septets, 70/67 Unicode code units, pairs preserved. Push
            preset: {snapshot.options.pushPreset}, {snapshot.options.pushOrder},{" "}
            {snapshot.assumptions.pushBudget.title}/
            {snapshot.assumptions.pushBudget.body} code points. Email inbox
            sample: 60/120 code points. Artificial SMS cutoff:{" "}
            {snapshot.options.smsCutoff
              ? "ENABLED — loss test, not a normal delivery payload"
              : "Disabled"}
            .
          </p>
          {CHANNELS.map((channel) => {
            const value = snapshot.channels[channel];
            return (
              <div className="report-channel" key={channel}>
                <h3>{channel.toUpperCase()}</h3>
                <p>
                  {value.status} · {value.errorCount} errors ·{" "}
                  {value.warningCount} warnings · {value.representedCount}/
                  {value.coverage.length} required facts included.
                </p>
                {channel === "sms" && (
                  <p>
                    {value.metrics.sms!.encoding} · {value.metrics.sms!.units}{" "}
                    {value.metrics.sms!.unitLabel} ·{" "}
                    {value.metrics.sms!.characters} code points ·{" "}
                    {value.metrics.sms!.segments} estimated standard-based
                    segments. Carrier behavior can differ.
                  </p>
                )}
                <details>
                  <summary>
                    Exact {channel.toUpperCase()} payload and visibility
                  </summary>
                  <pre className="recorded-payload">
                    {[value.payload.title.text, value.payload.body.text]
                      .filter(Boolean)
                      .join("\n\n")}
                  </pre>
                  {channel === "push" && (
                    <>
                      <h4>Collapsed push sample (approximate)</h4>
                      <pre className="recorded-payload">
                        {value.preview.title}
                        {"\n"}
                        {value.preview.body}
                      </pre>
                    </>
                  )}
                  <div className="report-coverage">
                    {value.coverage.map((fact) => (
                      <p key={fact.field}>
                        <strong>{fieldLabels[fact.field]}:</strong>{" "}
                        {fact.status}
                        {channel === "push"
                          ? `; collapsed: ${fact.collapsedVisibility}`
                          : ""}
                      </p>
                    ))}
                  </div>
                </details>
                <details>
                  <summary>
                    All {channel.toUpperCase()} findings and corrections
                  </summary>
                  {value.findings.map((finding) => (
                    <div className="report-finding" key={finding.id}>
                      <strong>{finding.title}</strong>
                      <code>
                        {finding.id} · {finding.severity} · {finding.status}
                      </code>
                      <p>{finding.explanation}</p>
                      <p>Suggested correction: {finding.suggestion}</p>
                    </div>
                  ))}
                </details>
              </div>
            );
          })}
        </section>
        {comparison && diff && (
          <section className="report-section">
            <h2>03 / Before and after comparison</h2>
            <p>
              Before: {comparison.before.id}. After: {comparison.after.id}.{" "}
              {diff.differentRules
                ? "Ruleset versions differ; interpret recorded differences accordingly."
                : "Recorded under the same ruleset version."}
            </p>
            <p>
              {diff.changedFields.length} changed source fields ·{" "}
              {diff.source.resolved.length} source issues resolved ·{" "}
              {diff.source.introduced.length} introduced ·{" "}
              {diff.source.unresolved.length} unresolved. No improvement or
              safety guarantee is assumed.
            </p>
            {diff.changedFields.map((change) => (
              <div className="report-finding" key={change.field}>
                <strong>
                  {change.field === "scenario"
                    ? "Scenario"
                    : fieldLabels[change.field]}
                </strong>
                <p>Before: {change.before || "[empty]"}</p>
                <p>After: {change.after || "[empty]"}</p>
              </div>
            ))}
            <details>
              <summary>
                Comparison findings and channel coverage changes
              </summary>
              <h3>Resolved source issues</h3>
              <IssueList issues={diff.source.resolved} />
              <h3>New source issues</h3>
              <IssueList issues={diff.source.introduced} />
              <h3>Unresolved source issues</h3>
              <IssueList issues={diff.source.unresolved} />
              {CHANNELS.map((channel) => (
                <div key={channel}>
                  <h3>{channel.toUpperCase()} changes</h3>
                  <p>
                    {diff.channels[channel].resolved.length} resolved ·{" "}
                    {diff.channels[channel].introduced.length} introduced ·{" "}
                    {diff.channels[channel].unresolved.length} unresolved.
                  </p>
                  <h4>Resolved channel issues</h4>
                  <IssueList issues={diff.channels[channel].resolved} />
                  <h4>New channel issues</h4>
                  <IssueList issues={diff.channels[channel].introduced} />
                  <h4>Unresolved channel issues</h4>
                  <IssueList issues={diff.channels[channel].unresolved} />
                  {diff.channels[channel].coverageChanges.map((change) => (
                    <p key={change.field}>
                      {fieldLabels[change.field]}:{" "}
                      {change.before
                        ? `${change.before.status} / ${change.before.collapsedVisibility}`
                        : "not applicable"}{" "}
                      →{" "}
                      {change.after
                        ? `${change.after.status} / ${change.after.collapsedVisibility}`
                        : "not applicable"}
                    </p>
                  ))}
                </div>
              ))}
            </details>
          </section>
        )}
        <section className="report-section">
          <h2>04 / Human review activity</h2>
          {records.length ? (
            records.map((review) => (
              <div className="report-review" key={review.id}>
                <h3>
                  {review.status === "completed"
                    ? "Review completed — self-attested"
                    : "Review in progress — recorded observations"}
                </h3>
                <p>
                  Reviewer-provided name: {review.name || "Not provided"}.
                  Role/team: {review.role || "Not provided"}. Identity and
                  authority are unverified.
                </p>
                <p>
                  {review.recordedAt} · local device clock. Current working
                  draft applicability:{" "}
                  <strong>{reviewApplicability(review, currentKey)}</strong>.
                </p>
                <p>Notes (user-entered): {review.notes || "None"}</p>
                <p>
                  Supporting reference/evidence note (unverified):{" "}
                  {review.evidenceNote || "None"}
                </p>
                <ul>
                  {manualChecklist(snapshot).map((item) => (
                    <li key={item.id}>
                      {review.checklist[item.id] ? "Checked" : "Unchecked"}:{" "}
                      {item.label}
                    </li>
                  ))}
                </ul>
                <h4>Unresolved warning acknowledgements</h4>
                {Object.entries(review.acknowledgements).map(([key, ack]) => (
                  <p key={key}>
                    {key} ·{" "}
                    {ack.acknowledged ? "Acknowledged" : "Not acknowledged"}.
                    Exception note: {ack.note || "None"}
                  </p>
                ))}
              </div>
            ))
          ) : (
            <p>
              Not reviewed. No human review is inferred from automated results.
            </p>
          )}
        </section>
        <section className="report-section">
          <h2>05 / Local content binding</h2>
          <p>
            Review records reference this exact snapshot and its canonical
            source, generated payloads, settings, evaluation and ruleset.
            Current working draft matches recorded content:{" "}
            <strong>
              {snapshot.contentKey === currentKey
                ? "Yes"
                : "No — re-review required"}
            </strong>
            .
          </p>
          <p>
            Local SHA-256 content fingerprint — not a digital signature or
            tamper-proof guarantee:
          </p>
          <code className="content-fingerprint">
            {fingerprint ??
              "Unavailable in this browser; exact canonical snapshot binding remains active."}
          </code>
          <details className="screen-only">
            <summary>
              Recompute using current rules (not recorded evidence)
            </summary>
            <p>
              Current source evaluation: {recomputed.result.errorCount} errors ·{" "}
              {recomputed.result.warningCount} warnings.{" "}
              {isCurrentEvaluation(snapshot)
                ? "Current evaluation matches the stored evaluation."
                : "Evaluation differs from this historical record."}{" "}
              Recorded results above are never overwritten. Restore and record a
              new version to create new evidence.
            </p>
            {CHANNELS.map((channel) => (
              <p key={channel}>
                {channel.toUpperCase()}:{" "}
                {recomputed.channels[channel].errorCount} errors ·{" "}
                {recomputed.channels[channel].warningCount} warnings.
              </p>
            ))}
          </details>
        </section>
        <section className="report-section report-limitations">
          <h2>06 / Limits and privacy</h2>
          <ul>
            {REPORT_LIMITATIONS.map((limit) => (
              <li key={limit}>{limit}</li>
            ))}
          </ul>
          <p>
            Review notes and records remain in local browser storage unless you
            explicitly export them. Avoid confidential information on shared
            browsers. Imported evidence is not authenticated.
          </p>
        </section>
        <footer className="report-footer">
          SignalProof · Before you send it, prove it works. · Internal decision
          support only.
        </footer>
      </article>
    </>
  );
}
