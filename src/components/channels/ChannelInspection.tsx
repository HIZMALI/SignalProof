import {
  ArrowRight,
  Check,
  ChevronDown,
  CircleAlert,
  Info,
  TriangleAlert,
} from "lucide-react";
import { useState } from "react";
import { fieldLabels } from "../../domain/scenarios";
import type { FieldKey } from "../../domain/types";
import type { ChannelAnalysisResult } from "../../domain/channels/types";
import { groupVisibilityWarnings } from "../../domain/evidence/review";
import type { ChannelFinding } from "../../domain/channels/types";

function ChannelFindingCard({
  finding,
  onEdit,
}: {
  finding: ChannelFinding;
  onEdit: (field?: FieldKey) => void;
}) {
  return (
    <article className={`channel-finding ${finding.severity}`}>
      <div className="channel-finding-title">
        {finding.severity === "error" ? (
          <CircleAlert size={16} />
        ) : finding.severity === "warning" ? (
          <TriangleAlert size={16} />
        ) : (
          <Info size={16} />
        )}
        <h3>{finding.title}</h3>
      </div>
      <code>{finding.id}</code>
      <p>{finding.explanation}</p>
      <p className="channel-correction">{finding.suggestion}</p>
      {finding.field && (
        <button onClick={() => onEdit(finding.field)}>
          Edit source field <ArrowRight size={13} />
        </button>
      )}
    </article>
  );
}

export function ChannelInspection({
  analysis,
  onEdit,
}: {
  analysis: ChannelAnalysisResult;
  onEdit: (field?: FieldKey) => void;
}) {
  const [showPassed, setShowPassed] = useState(false);
  const [filter, setFilter] = useState<"all" | "error" | "warning">("all");
  const active = analysis.findings.filter(
    (f) => f.status === "failed" && (filter === "all" || f.severity === filter),
  );
  const passed = analysis.findings.filter((f) => f.status === "passed");
  const grouped = groupVisibilityWarnings(active);
  const action = analysis.coverage.find((fact) => fact.field === "action");
  return (
    <div className="channel-inspection">
      <section
        className="panel coverage-panel"
        aria-label="Essential fact coverage"
      >
        <div className="inspection-heading">
          <div>
            <h2>Did the essentials make it?</h2>
            <p>Semantic references in the actual generated text.</p>
          </div>
          <span>
            {analysis.representedCount} / {analysis.coverage.length}
          </span>
        </div>
        <table className="coverage-table">
          <caption className="sr-only">
            Required facts in the full payload and collapsed preview
          </caption>
          <thead>
            <tr className="coverage-row coverage-labels">
              <th scope="col">REQUIRED FACT</th>
              <th scope="col">FULL PAYLOAD</th>
              {analysis.payload.channel === "push" && (
                <th scope="col">COLLAPSED CARD</th>
              )}
            </tr>
          </thead>
          <tbody>
            {analysis.coverage.map((fact) => (
              <tr key={fact.field} className="coverage-row">
                <th scope="row">
                  <button
                    onClick={() => onEdit(fact.field)}
                    title={`Edit ${fieldLabels[fact.field].toLowerCase()}`}
                  >
                    {fieldLabels[fact.field]}
                  </button>
                </th>
                <td>
                  <span className={`coverage-state ${fact.status}`}>
                    {fact.status === "represented" ? (
                      <Check size={12} />
                    ) : (
                      <CircleAlert size={12} />
                    )}
                    {fact.status === "represented"
                      ? "Included"
                      : fact.status === "source-missing"
                        ? "Source missing"
                        : fact.status === "source-invalid"
                          ? "Source invalid"
                          : "Omitted"}
                  </span>
                </td>
                {analysis.payload.channel === "push" && (
                  <td>
                    <span
                      className={`visibility-state visibility-${fact.collapsedVisibility}`}
                    >
                      {fact.collapsedVisibility === "unavailable"
                        ? "—"
                        : fact.collapsedVisibility === "partial"
                          ? "Partial"
                          : fact.collapsedVisibility === "hidden"
                            ? "Hidden"
                            : "Visible"}
                    </span>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="coverage-footnote">
          Included means a complete, current fact is represented. It does not
          prove that the fact is true or that a person will see it.
        </p>
      </section>
      <section className="panel channel-findings" aria-label="Channel findings">
        <div className="inspection-heading">
          <div>
            <h2>Channel findings</h2>
            <p>
              {analysis.errorCount} errors · {analysis.warningCount} warnings
            </p>
          </div>
          <div
            className="finding-filter"
            role="group"
            aria-label="Filter channel findings"
          >
            {(["all", "error", "warning"] as const).map((value) => (
              <button
                key={value}
                aria-pressed={filter === value}
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
        <div className="channel-finding-list">
          {active.length ? (
            <>
              {grouped.other.map((finding) => (
                <ChannelFindingCard
                  key={finding.id}
                  finding={finding}
                  onEdit={onEdit}
                />
              ))}
              {grouped.critical.length + grouped.general.length > 0 && (
                <div className="visibility-warning-summary">
                  <h3>
                    Some required details are only visible after expanding the
                    notification.
                  </h3>
                  <p>
                    A collapsed push card is inherently limited.{" "}
                    {action?.status !== "represented"
                      ? "The action is missing or invalid; resolve its blocking finding."
                      : action.collapsedVisibility === "visible"
                        ? "The complete required action remains visible."
                        : `The required action is ${action.collapsedVisibility} in the collapsed card.`}
                  </p>
                  <p>
                    {grouped.critical.length} action/time/location concerns ·{" "}
                    {grouped.general.length} general visibility limitations. All{" "}
                    {grouped.critical.length + grouped.general.length}{" "}
                    underlying warnings remain counted.
                  </p>
                  {grouped.critical.length > 0 && (
                    <details open>
                      <summary>
                        Priority: action, time and location ·{" "}
                        {grouped.critical.length}
                      </summary>
                      <p>
                        {grouped.critical
                          .filter((f) => f.field)
                          .map((f) => fieldLabels[f.field!])
                          .join(" · ")}
                      </p>
                      {grouped.critical.map((finding) => (
                        <ChannelFindingCard
                          key={finding.id}
                          finding={finding}
                          onEdit={onEdit}
                        />
                      ))}
                    </details>
                  )}
                  {grouped.general.length > 0 && (
                    <details>
                      <summary>
                        General collapsed-card limitations ·{" "}
                        {grouped.general.length}
                      </summary>
                      {grouped.general.map((finding) => (
                        <ChannelFindingCard
                          key={finding.id}
                          finding={finding}
                          onEdit={onEdit}
                        />
                      ))}
                    </details>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="channel-no-findings">
              <Check size={20} />
              <p>
                No open{" "}
                {filter === "all"
                  ? "findings"
                  : filter === "error"
                    ? "errors"
                    : "warnings"}{" "}
                in this view. This does not certify safety or approve
                publication.
              </p>
            </div>
          )}
        </div>
        <button
          className="passed-toggle"
          aria-expanded={showPassed}
          onClick={() => setShowPassed(!showPassed)}
        >
          <Check size={14} />
          {passed.length} passed channel checks
          <ChevronDown size={14} className={showPassed ? "rotated" : ""} />
        </button>
        {showPassed && (
          <ul className="channel-passed">
            {passed.map((finding) => (
              <li key={finding.id}>
                <strong>{finding.title}</strong>
                <code>{finding.id}</code>
                <p>{finding.explanation}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
