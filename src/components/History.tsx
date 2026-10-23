import {
  ArrowLeft,
  ArrowUpRight,
  Clock3,
  History as HistoryIcon,
} from "lucide-react";
import { scenarios } from "../domain/scenarios";
import type { EvidenceSnapshot } from "../domain/evidence/types";

export function History({
  runs,
  onRestore,
  onBack,
  onReview,
  onReport,
  onCompare,
  persisted,
}: {
  runs: EvidenceSnapshot[];
  onRestore: (run: EvidenceSnapshot) => void;
  onBack: () => void;
  onReview: (id: string) => void;
  onReport: (id: string) => void;
  onCompare: () => void;
  persisted: boolean;
}) {
  return (
    <div className="secondary-view">
      <div className="page-heading">
        <span className="eyebrow">
          <HistoryIcon size={14} /> YOUR REVIEW TRAIL
        </span>
        <h1>
          Every check tells a story<span>.</span>
        </h1>
        <p>
          Recorded source and channel evidence, kept locally across reloads when
          storage is available. This is not an immutable external audit log.
        </p>
      </div>
      <div className="history-toolbar">
        <h2>
          Validation history <span>{runs.length} / 50 runs</span>
        </h2>
        <div className="review-actions">
          <span className="evidence-muted">
            {persisted
              ? "Saved in this browser"
              : "Memory only — export a backup"}
          </span>
          <button
            className="button button-secondary"
            disabled={!runs.length}
            onClick={onCompare}
          >
            Compare versions
          </button>
          <button className="button button-secondary" onClick={onBack}>
            <ArrowLeft size={15} /> Back to lab
          </button>
        </div>
      </div>
      {runs.length === 0 ? (
        <div className="panel empty-state">
          <Clock3 size={34} />
          <h2>Your first run starts here.</h2>
          <p>
            Run a validation in the lab to capture a draft and its findings.
            Live edits do not add history entries.
          </p>
          <button className="button button-primary" onClick={onBack}>
            Open announcement lab <ArrowUpRight size={16} />
          </button>
        </div>
      ) : (
        <div className="history-list">
          {runs.map((run, index) => (
            <article className="panel history-card" key={run.id}>
              <span className="history-number">
                {String(runs.length - index).padStart(2, "0")}
              </span>
              <div className="history-details">
                <span className="small-eyebrow">
                  {scenarios[run.draft.scenario].shortLabel}
                  {run.origin === "demo" && " · ILLUSTRATIVE DEMO"}
                </span>
                <p className="evidence-muted">
                  Recorded rules: {run.rulesetVersion} · {run.id.slice(0, 8)} ·
                  local device clock
                </p>
                <h3>{run.draft.title.trim() || "Untitled announcement"}</h3>
                <span className="history-time">
                  <Clock3 size={12} />
                  <time dateTime={run.timestamp}>
                    {new Date(run.timestamp).toLocaleString("en-GB", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </time>
                </span>
              </div>
              <div className="history-stats">
                <span
                  className={run.result.errorCount ? "text-error" : "text-teal"}
                >
                  {run.result.errorCount} errors
                </span>
                <span>{run.result.warningCount} warnings</span>
                <span>{run.result.completeness}% fields</span>
              </div>
              <div className="history-evidence-actions">
                <button
                  className="button button-quiet"
                  onClick={() => onReview(run.id)}
                >
                  Review snapshot
                </button>
                <button
                  className="button button-quiet"
                  onClick={() => onReport(run.id)}
                >
                  Evidence report
                </button>
                <button
                  className="button button-secondary"
                  onClick={() => onRestore(run)}
                >
                  Restore draft <ArrowUpRight size={14} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
