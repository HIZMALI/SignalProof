import { ClipboardCheck, Info, LockKeyhole } from "lucide-react";
import { useState } from "react";
import {
  manualChecklist,
  emptyReviewForm,
  recordReview,
  reviewApplicability,
  reviewBlockers,
  snapshotIssues,
} from "../../domain/evidence/review";
import { isCurrentEvaluation } from "../../domain/evidence/snapshot";
import { CHANNELS } from "../../domain/evidence/types";
import type {
  EvidenceSnapshot,
  ReviewRecord,
} from "../../domain/evidence/types";
import { IssueList } from "./ComparisonView";

export function ManualReview({
  snapshot,
  reviews,
  currentKey,
  onRecord,
  onReport,
  onRecompute,
}: {
  snapshot: EvidenceSnapshot;
  reviews: ReviewRecord[];
  currentKey: string;
  onRecord: (record: ReviewRecord) => void;
  onReport: () => void;
  onRecompute: () => void;
}) {
  const [form, setForm] = useState(emptyReviewForm);
  const [failure, setFailure] = useState("");
  const issues = snapshotIssues(snapshot);
  const errors = issues.filter((issue) => issue.severity === "error");
  const warnings = issues.filter((issue) => issue.severity === "warning");
  const blockers = reviewBlockers(snapshot, form);
  const records = reviews.filter((review) => review.snapshotId === snapshot.id);
  function save(status: ReviewRecord["status"]) {
    const result = recordReview(snapshot, form, status);
    if (result.record) {
      onRecord(result.record);
      setFailure("");
    } else setFailure(result.blockers.join(" "));
  }
  return (
    <div className="manual-review">
      <div className="evidence-note">
        <Info size={16} />
        <p>
          <strong>Manual self-attestation, not automated approval.</strong>{" "}
          Reviewer identity and authority are not verified. Responses are saved
          only when you record observations or complete review. Navigation or
          switching snapshots discards unrecorded responses. Notes stay in this
          browser; avoid confidential information on shared devices.
        </p>
      </div>
      {snapshot.origin === "demo" && (
        <div className="evidence-note">
          Illustrative demo evidence. No human review was prefilled. Do not
          claim that fictional demo facts were independently verified in the
          real world.
        </div>
      )}
      {snapshot.contentKey !== currentKey && (
        <div className="review-outdated">
          Content changed since review. Re-review required. This recorded
          version differs from the current working draft; any review below
          applies only to this exact recorded content.
        </div>
      )}
      {!isCurrentEvaluation(snapshot) && (
        <div className="review-outdated">
          This is historical evidence under a different or changed evaluation.{" "}
          <button className="button button-secondary" onClick={onRecompute}>
            Recompute and record a new version
          </button>
        </div>
      )}
      <div className="review-layout">
        <div>
          <section className="panel evidence-section">
            <span className="eyebrow">EXACT CONTENT UNDER REVIEW</span>
            <h2>{snapshot.draft.title || "Untitled announcement"}</h2>
            <p className="evidence-muted">
              Snapshot {snapshot.id} · recorded{" "}
              {new Date(snapshot.timestamp).toLocaleString("en-GB")} using the
              local device clock. Rules: {snapshot.rulesetVersion}.
            </p>
            <details open>
              <summary>Recorded source announcement</summary>
              <pre className="recorded-payload">
                {snapshot.result.finalAnnouncement}
              </pre>
            </details>
            {CHANNELS.map((channel) => (
              <details key={channel}>
                <summary>
                  {channel.toUpperCase()} · exact recorded payload
                </summary>
                <pre className="recorded-payload">
                  {[
                    snapshot.channels[channel].payload.title.text,
                    snapshot.channels[channel].payload.body.text,
                  ]
                    .filter(Boolean)
                    .join("\n\n")}
                </pre>
                {channel === "push" && (
                  <>
                    <p className="evidence-muted">
                      Collapsed card under {snapshot.options.pushPreset} /{" "}
                      {snapshot.options.pushOrder}:
                    </p>
                    <pre className="recorded-payload">
                      {snapshot.channels.push.preview.title}
                      {"\n"}
                      {snapshot.channels.push.preview.body}
                    </pre>
                  </>
                )}
              </details>
            ))}
          </section>
          <section className="panel evidence-section">
            <h2>Outstanding automated checks</h2>
            <p>
              {snapshot.result.errorCount} source errors ·{" "}
              {CHANNELS.reduce(
                (sum, channel) => sum + snapshot.channels[channel].errorCount,
                0,
              )}{" "}
              channel errors · {warnings.length} warnings requiring
              acknowledgement.
            </p>
            {errors.length ? (
              <details open>
                <summary>Errors block review completion</summary>
                <IssueList issues={errors} />
              </details>
            ) : (
              <p className="evidence-muted">
                No recorded source/channel errors. Manual review and warning
                acknowledgement are still required.
              </p>
            )}
          </section>
        </div>
        <form
          className="review-form panel evidence-section"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            save("completed");
          }}
        >
          <span className="eyebrow">
            <ClipboardCheck size={14} /> HUMAN RESPONSES
          </span>
          <h2>Check the facts. Record your judgment.</h2>
          <div className="form-field">
            <label htmlFor="review-name">
              Reviewer display name <span className="required-dot">*</span>
            </label>
            <input
              id="review-name"
              aria-required="true"
              value={form.name}
              maxLength={120}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Self-provided; identity is not verified"
              aria-describedby="review-name-hint"
            />
            <p className="field-hint" id="review-name-hint">
              Required to complete review. You can record incomplete
              observations without a name.
            </p>
          </div>
          <div className="form-field">
            <label htmlFor="review-role">
              Role or team <span className="optional-label">Optional</span>
            </label>
            <input
              id="review-role"
              value={form.role}
              maxLength={120}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            />
          </div>
          <fieldset className="manual-checklist">
            <legend>Manual checklist — separate from automated checks</legend>
            {manualChecklist(snapshot).map((item) => (
              <label key={item.id}>
                <input
                  type="checkbox"
                  checked={form.checklist[item.id] === true}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      checklist: {
                        ...form.checklist,
                        [item.id]: e.target.checked,
                      },
                    })
                  }
                />
                <span>{item.label}</span>
              </label>
            ))}
          </fieldset>
          {warnings.length > 0 && (
            <div className="review-warning-acks">
              <h3>Acknowledge unresolved warnings</h3>
              <p>
                Each warning needs an explicit response. A note can explain your
                decision; acknowledgement does not remove the finding.
              </p>
              {(["critical", "general"] as const).map((priority) => {
                const group = warnings.filter(
                  (issue) => issue.priority === priority,
                );
                return group.length ? (
                  <fieldset key={priority}>
                    <legend>
                      {priority === "critical"
                        ? "Action, time and location concerns"
                        : "Format and general limitations"}{" "}
                      · {group.length}
                    </legend>
                    {group.map((issue) => (
                      <div className="warning-ack" key={issue.key}>
                        <label>
                          <input
                            type="checkbox"
                            checked={
                              form.acknowledgements[issue.key]?.acknowledged ===
                              true
                            }
                            onChange={(e) =>
                              setForm({
                                ...form,
                                acknowledgements: {
                                  ...form.acknowledgements,
                                  [issue.key]: {
                                    acknowledged: e.target.checked,
                                    note:
                                      form.acknowledgements[issue.key]?.note ??
                                      "",
                                  },
                                },
                              })
                            }
                          />
                          <span>
                            {issue.scope.toUpperCase()} · {issue.title}
                            <code>{issue.id}</code>
                          </span>
                        </label>
                        <p>{issue.explanation}</p>
                        {form.acknowledgements[issue.key]?.acknowledged && (
                          <div className="form-field">
                            <label htmlFor={`ack-${issue.key}`}>
                              Exception / acknowledgement note for {issue.id}{" "}
                              <span className="optional-label">Optional</span>
                            </label>
                            <textarea
                              id={`ack-${issue.key}`}
                              rows={2}
                              value={form.acknowledgements[issue.key].note}
                              maxLength={500}
                              onChange={(e) =>
                                setForm({
                                  ...form,
                                  acknowledgements: {
                                    ...form.acknowledgements,
                                    [issue.key]: {
                                      acknowledged: true,
                                      note: e.target.value,
                                    },
                                  },
                                })
                              }
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </fieldset>
                ) : null;
              })}
            </div>
          )}
          <div className="form-field">
            <label htmlFor="review-notes">Review notes</label>
            <textarea
              id="review-notes"
              rows={4}
              maxLength={3000}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Record what you checked and what still needs attention."
            />
          </div>
          <div className="form-field">
            <label htmlFor="review-evidence">
              Supporting source reference or evidence note{" "}
              <span className="optional-label">Optional</span>
            </label>
            <textarea
              id="review-evidence"
              rows={2}
              maxLength={2000}
              value={form.evidenceNote}
              onChange={(e) =>
                setForm({ ...form, evidenceNote: e.target.value })
              }
              placeholder="A source description or reference, recorded as unverified text."
            />
          </div>
          <div
            className="review-blockers"
            id="review-blockers"
            aria-live="polite"
          >
            <strong>
              {errors.length || snapshot.options.smsCutoff
                ? "Review blocked by unresolved errors / loss-test state"
                : blockers.length
                  ? "Review in progress"
                  : "Ready to record self-attestation"}
            </strong>
            {blockers.length > 0 && (
              <ul>
                {blockers.map((blocker) => (
                  <li key={blocker}>{blocker}</li>
                ))}
              </ul>
            )}
          </div>
          {failure && <p role="alert">{failure}</p>}
          <div className="review-actions">
            <button
              type="button"
              className="button button-secondary"
              onClick={() => save("observations")}
            >
              Record observations
            </button>
            <button
              type="submit"
              className="button button-primary"
              disabled={blockers.length > 0}
              aria-describedby="review-blockers"
            >
              Complete review — self-attest
            </button>
          </div>
          <p className="evidence-muted">
            <LockKeyhole size={12} /> Local browser records only. Completion
            records acknowledgement; it is not a safety certificate or
            permission to send.
          </p>
        </form>
      </div>
      <section className="panel evidence-section">
        <div className="evidence-heading">
          <h2>Recorded human activity</h2>
          <button className="button button-secondary" onClick={onReport}>
            View evidence report
          </button>
        </div>
        {records.length ? (
          records.map((review) => (
            <details className="review-record" key={review.id}>
              <summary>
                {review.status === "completed"
                  ? "Review completed — self-attested"
                  : "Review in progress — recorded observations"}{" "}
                · {review.name || "Name not provided"}
              </summary>
              <p>
                Reviewer-provided role/team: {review.role || "Not provided"}.
                Identity unverified.
              </p>
              <p>
                {new Date(review.recordedAt).toLocaleString("en-GB")} · local
                device clock. Current working draft applicability:{" "}
                {reviewApplicability(review, currentKey)}.
              </p>
              <p>Notes: {review.notes || "None"}</p>
              <p>Evidence note: {review.evidenceNote || "None"}</p>
              <ul>
                {manualChecklist(snapshot).map((item) => (
                  <li key={item.id}>
                    {review.checklist[item.id] ? "Checked" : "Unchecked"}:{" "}
                    {item.label}
                  </li>
                ))}
              </ul>
              {Object.entries(review.acknowledgements).map(([key, ack]) => (
                <p key={key}>
                  {key}:{" "}
                  {ack.acknowledged ? "Acknowledged" : "Not acknowledged"}.{" "}
                  {ack.note}
                </p>
              ))}
            </details>
          ))
        ) : (
          <p className="evidence-muted">
            Not reviewed. No human review has been fabricated or inferred from
            automated checks.
          </p>
        )}
      </section>
    </div>
  );
}
