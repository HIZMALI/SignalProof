import { ArrowRight, GitCompareArrows } from "lucide-react";
import { useMemo } from "react";
import { fieldLabels, scenarios } from "../../domain/scenarios";
import { compareSnapshots } from "../../domain/evidence/comparison";
import { CHANNELS } from "../../domain/evidence/types";
import type {
  EvidenceSnapshot,
  ReviewIssue,
  ReviewRecord,
} from "../../domain/evidence/types";

export function IssueList({
  issues,
  empty = "None in this category.",
}: {
  issues: ReviewIssue[];
  empty?: string;
}) {
  return issues.length ? (
    <ul className="evidence-issue-list">
      {issues.map((issue) => (
        <li key={`${issue.key}-${issue.severity}`}>
          <span className={`issue-severity ${issue.severity}`}>
            {issue.severity}
          </span>
          <div>
            <strong>{issue.title}</strong>
            <code>
              {issue.scope} · {issue.id}
            </code>
            <p>{issue.suggestion}</p>
          </div>
        </li>
      ))}
    </ul>
  ) : (
    <p className="evidence-muted">{empty}</p>
  );
}
export function ComparisonView({
  snapshots,
  reviews,
  beforeId,
  afterId,
  onSelect,
  onReport,
}: {
  snapshots: EvidenceSnapshot[];
  reviews: ReviewRecord[];
  beforeId: string;
  afterId: string;
  onSelect: (before: string, after: string) => void;
  onReport: (id: string) => void;
}) {
  const before = snapshots.find((s) => s.id === beforeId) ?? snapshots.at(-1);
  const after = snapshots.find((s) => s.id === afterId) ?? snapshots[0];
  const diff = useMemo(
    () => (before && after ? compareSnapshots(before, after) : null),
    [before, after],
  );
  if (!before || !after || !diff)
    return (
      <div className="panel empty-state">
        <GitCompareArrows size={32} />
        <h2>Two versions tell the story.</h2>
        <p>
          Record versions in the Announcement Lab or create the two clearly
          labeled demo snapshots above.
        </p>
      </div>
    );
  const card = (snapshot: EvidenceSnapshot, label: string) => {
    const review = reviews.find((r) => r.snapshotId === snapshot.id);
    return (
      <article className="panel comparison-card">
        <span className="eyebrow">{label}</span>
        <h3>{snapshot.draft.title || "Untitled announcement"}</h3>
        <span className="snapshot-subtitle">
          {scenarios[snapshot.draft.scenario].label} · {snapshot.id.slice(0, 8)}
        </span>
        <p className="evidence-muted">
          {new Date(snapshot.timestamp).toLocaleString("en-GB")} · local device
          clock
        </p>
        <div className="comparison-counts">
          <div>
            <strong>{snapshot.result.errorCount}</strong>
            <span>errors</span>
          </div>
          <div>
            <strong>{snapshot.result.warningCount}</strong>
            <span>warnings</span>
          </div>
          <div>
            <strong>{snapshot.result.passedCount}</strong>
            <span>passed</span>
          </div>
          <div>
            <strong>{snapshot.result.completeness}%</strong>
            <span>field presence</span>
          </div>
        </div>
        <p className="evidence-muted">
          Recorded source: {snapshot.result.status}. Rules:{" "}
          {snapshot.rulesetVersion}.
        </p>
        <p className="record-review-state">
          {review
            ? review.status === "completed"
              ? "Recorded review: completed — self-attested"
              : "Recorded observations / review in progress"
            : "Not reviewed"}
        </p>
        <button
          className="button button-secondary"
          onClick={() => onReport(snapshot.id)}
        >
          Inspect this evidence <ArrowRight size={14} />
        </button>
      </article>
    );
  };
  return (
    <div className="comparison-view">
      <div className="comparison-selectors">
        <div className="form-field">
          <label htmlFor="compare-before">Before snapshot</label>
          <select
            id="compare-before"
            value={before.id}
            onChange={(e) => onSelect(e.target.value, after.id)}
          >
            {snapshots.map((s) => (
              <option value={s.id} key={s.id}>
                {s.draft.title || "Untitled"} · {s.id.slice(0, 8)}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="compare-after">After snapshot</label>
          <select
            id="compare-after"
            value={after.id}
            onChange={(e) => onSelect(before.id, e.target.value)}
          >
            {snapshots.map((s) => (
              <option value={s.id} key={s.id}>
                {s.draft.title || "Untitled"} · {s.id.slice(0, 8)}
              </option>
            ))}
          </select>
        </div>
      </div>
      {diff.sameSnapshot && (
        <div className="evidence-note">
          The same snapshot is selected twice. No source or channel changes are
          implied.
        </div>
      )}
      {diff.differentRules && (
        <div className="evidence-note">
          Ruleset versions differ. These are recorded results, not an
          identical-rules experiment.
        </div>
      )}
      <div className="comparison-grid">
        {card(before, "BEFORE · RECORDED")}
        {card(after, "AFTER · RECORDED")}
      </div>
      <div className="comparison-summary" role="status">
        <span>
          <strong>{diff.changedFields.length}</strong> fields changed
        </span>
        <span>
          <strong>
            {diff.source.resolved.filter((f) => f.severity === "error").length}
          </strong>{" "}
          source errors resolved
        </span>
        <span>
          <strong>{diff.source.introduced.length}</strong> new source issues
          introduced
        </span>
        <span>
          <strong>{diff.source.unresolved.length}</strong> source issues remain
        </span>
        <p>
          Required field completeness{" "}
          {diff.completenessDelta > 0
            ? `increased by ${diff.completenessDelta}`
            : diff.completenessDelta < 0
              ? `decreased by ${-diff.completenessDelta}`
              : "changed by 0"}{" "}
          percentage points. Field presence is not a safety score.
        </p>
      </div>
      <section className="panel evidence-section">
        <h2>Changed source fields</h2>
        {diff.changedFields.length ? (
          <div className="changed-fields">
            {diff.changedFields.map((change) => (
              <div key={change.field}>
                <h3>
                  {change.field === "scenario"
                    ? "Scenario"
                    : fieldLabels[change.field]}
                </h3>
                <div className="comparison-grid">
                  <p>
                    <span>BEFORE</span>
                    {change.before || "[empty]"}
                  </p>
                  <p>
                    <span>AFTER</span>
                    {change.after || "[empty]"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="evidence-muted">
            No source fields changed. Channel configurations or evaluations may
            still differ.
          </p>
        )}
      </section>
      <div className="comparison-grid">
        <section className="panel evidence-section">
          <h2>Resolved source findings</h2>
          <IssueList issues={diff.source.resolved} />
        </section>
        <section className="panel evidence-section">
          <h2>New source findings</h2>
          <IssueList issues={diff.source.introduced} />
        </section>
      </div>
      <section className="panel evidence-section">
        <h2>Unresolved source findings</h2>
        <IssueList issues={diff.source.unresolved} />
      </section>
      <section className="panel evidence-section">
        <h2>Required source facts</h2>
        <div className="fact-comparison-list">
          {[
            ...new Set([
              ...before.requiredFacts.map((f) => f.field),
              ...after.requiredFacts.map((f) => f.field),
            ]),
          ].map((field) => (
            <div key={field}>
              <strong>{fieldLabels[field]}</strong>
              <div className="comparison-grid">
                {[before, after].map((snapshot, index) => {
                  const fact = snapshot.requiredFacts.find(
                    (f) => f.field === field,
                  );
                  return (
                    <p key={index}>
                      <span>
                        {index ? "AFTER" : "BEFORE"} ·{" "}
                        {fact ? fact.state : "Not applicable"}
                      </span>
                      {fact?.value || "[empty / not applicable]"}
                    </p>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>
      {CHANNELS.map((channel) => (
        <section className="panel evidence-section" key={channel}>
          <h2>{channel.toUpperCase()} · channel differences</h2>
          <div className="comparison-grid">
            {[before, after].map((s, index) => (
              <div key={index}>
                <span className="small-eyebrow">
                  {index ? "AFTER" : "BEFORE"}
                </span>
                <p>
                  {s.channels[channel].errorCount} errors ·{" "}
                  {s.channels[channel].warningCount} warnings ·{" "}
                  {
                    s.channels[channel].findings.filter(
                      (f) => f.status === "passed",
                    ).length
                  }{" "}
                  passed · {s.channels[channel].representedCount}/
                  {s.channels[channel].coverage.length} required facts
                </p>
              </div>
            ))}
          </div>
          <p className="evidence-muted">
            {diff.channels[channel].resolved.length} resolved ·{" "}
            {diff.channels[channel].introduced.length} introduced ·{" "}
            {diff.channels[channel].unresolved.length} unresolved.
            Configuration: {JSON.stringify(before.options)} →{" "}
            {JSON.stringify(after.options)}
          </p>
          <details>
            <summary>Inspect findings and coverage changes</summary>
            <h3>Resolved</h3>
            <IssueList issues={diff.channels[channel].resolved} />
            <h3>Introduced</h3>
            <IssueList issues={diff.channels[channel].introduced} />
            <h3>Unresolved</h3>
            <IssueList issues={diff.channels[channel].unresolved} />
            {diff.channels[channel].coverageChanges.map((change) => (
              <p className="coverage-change" key={change.field}>
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
          </details>
        </section>
      ))}
      <p className="evidence-muted">
        A later version is not assumed to be better. Only recorded differences
        are shown. Neither comparison nor passing checks certifies safety or
        authorizes publication.
      </p>
    </div>
  );
}
