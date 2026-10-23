import {
  ArrowRight,
  Check,
  CheckCheck,
  ChevronDown,
  CircleAlert,
  CircleCheck,
  Info,
  ListChecks,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { useState } from "react";
import type { FieldKey, Finding, ValidationResult } from "../domain/types";

const statusLabels = {
  "needs-attention": "Needs attention",
  "review-needed": "Review recommended",
  "checks-passed": "Applicable checks passed",
};

function FindingCard({
  finding,
  onFix,
}: {
  finding: Finding;
  onFix: (field: FieldKey) => void;
}) {
  const isError = finding.severity === "error";
  return (
    <article className={`finding-card ${isError ? "error" : "warning"}`}>
      <div className="finding-topline">
        <span>
          {isError ? <CircleAlert size={15} /> : <TriangleAlert size={15} />}
          {isError ? "REQUIRED" : "REVIEW"}
        </span>
        <code>{finding.id}</code>
      </div>
      <h3>{finding.title}</h3>
      <p>{finding.explanation}</p>
      <div className="finding-suggestion">{finding.suggestion}</div>
      <button onClick={() => onFix(finding.field)}>
        Go to field <ArrowRight size={13} />
      </button>
    </article>
  );
}

export function Results({
  result,
  onFix,
  isRecorded,
  onRun,
  historySaved = true,
}: {
  result: ValidationResult;
  onFix: (field: FieldKey) => void;
  isRecorded: boolean;
  onRun: () => void;
  historySaved?: boolean;
}) {
  const [filter, setFilter] = useState<"all" | "error" | "warning">("all");
  const [showPassed, setShowPassed] = useState(false);
  const failed = result.findings.filter(
    (f) => f.status === "failed" && (filter === "all" || f.severity === filter),
  );
  return (
    <aside className="results-column" aria-label="Live validation results">
      <section
        className="panel results-panel"
        id="validation-results"
        tabIndex={-1}
        aria-label="Current automated source results"
      >
        <p className="sr-only">
          {statusLabels[result.status]}. {result.errorCount} errors and{" "}
          {result.warningCount} warnings. {result.completeness} percent required
          field completeness.
        </p>
        <div className="results-heading">
          <h2>
            <ListChecks size={18} /> Validation results
          </h2>
          <span className="live-label">
            <i /> LOCAL LIVE{" "}
            <span className="sr-only">
              local recalculation, no delivery connection
            </span>
          </span>
        </div>
        <div className={`result-status ${result.status}`}>
          <div className="result-icon">
            {result.errorCount ? (
              <ShieldCheck size={25} />
            ) : (
              <CircleCheck size={25} />
            )}
          </div>
          <div>
            <span className="small-eyebrow">
              {result.errorCount
                ? "A FEW DETAILS TO RESOLVE"
                : result.warningCount
                  ? "ONE MORE HUMAN LOOK"
                  : "STRUCTURED CHECKS COMPLETE"}
            </span>
            <h3>{statusLabels[result.status]}</h3>
          </div>
        </div>
        <p className="result-description">
          {result.errorCount
            ? "Catch the gaps now, before your audience has to."
            : result.warningCount
              ? "The essentials are present. Review the remaining guidance."
              : "All applicable rules pass. Verify the facts and get human approval."}
        </p>
        <div className="result-counts">
          <span>
            <i className="error-dot" />
            {result.errorCount} {result.errorCount === 1 ? "error" : "errors"}
          </span>
          <span>
            <i className="warning-dot" />
            {result.warningCount}{" "}
            {result.warningCount === 1 ? "warning" : "warnings"}
          </span>
          <span>
            <Check size={13} />
            {result.passedCount} passed
          </span>
        </div>
        <div className="findings-toolbar">
          <span>FINDINGS</span>
          <div role="group" aria-label="Filter findings">
            {(["all", "error", "warning"] as const).map((value) => (
              <button
                key={value}
                aria-pressed={filter === value}
                className={filter === value ? "active" : ""}
                onClick={() => setFilter(value)}
              >
                {value === "all"
                  ? "All"
                  : value === "error"
                    ? "Errors"
                    : "Warnings"}
              </button>
            ))}
          </div>
        </div>
        <div className="findings-list">
          {failed.length ? (
            failed.map((finding) => (
              <FindingCard key={finding.id} finding={finding} onFix={onFix} />
            ))
          ) : (
            <div className="empty-findings">
              <CircleCheck size={30} />
              <h3>
                {filter === "all"
                  ? "Looking clear."
                  : `No ${filter === "error" ? "errors" : "warnings"} found.`}
              </h3>
              <p>
                {filter === "all"
                  ? "The structured announcement meets the applicable rules. Your final review still matters."
                  : "Check the other filters for any remaining findings."}
              </p>
            </div>
          )}
        </div>
        <button
          className="passed-toggle"
          aria-expanded={showPassed}
          onClick={() => setShowPassed(!showPassed)}
        >
          <CheckCheck size={16} />
          <span>{result.passedCount} passed checks</span>
          <ChevronDown size={15} className={showPassed ? "rotated" : ""} />
        </button>
        {showPassed && (
          <ul className="passed-list">
            {result.findings
              .filter((f) => f.status === "passed")
              .map((f) => (
                <li key={f.id}>
                  <Check size={14} />
                  <div>
                    <strong>{f.title}</strong>
                    <p>{f.explanation}</p>
                    <code>{f.id}</code>
                  </div>
                </li>
              ))}
          </ul>
        )}
        <div className="run-record">
          <span className={isRecorded ? "recorded" : ""}>
            <i />
            {isRecorded
              ? historySaved
                ? "This version is recorded in local history"
                : "This version is recorded in memory only"
              : "Live changes · not yet recorded"}
          </span>
          <button onClick={onRun}>
            {isRecorded ? "Run again" : "Record run"}
            <ArrowRight size={13} />
          </button>
        </div>
      </section>
      <div className="review-note">
        <Info size={17} />
        <div>
          <strong>A second pair of eyes, built in.</strong>
          <p>
            SignalProof checks completeness and basic consistency. It does not
            verify facts, certify accessibility, or authorize emergency alerts.
          </p>
        </div>
      </div>
      <div className="engine-note">
        <span className="engine-dot" /> Deterministic rules. Explainable
        results.<span>Source rules v2.0</span>
      </div>
    </aside>
  );
}
