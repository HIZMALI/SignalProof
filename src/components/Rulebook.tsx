import {
  ArrowLeft,
  BookOpen,
  CircleAlert,
  Info,
  TriangleAlert,
} from "lucide-react";
import { useState } from "react";
import { fieldLabels, scenarios } from "../domain/scenarios";
import type { ScenarioId } from "../domain/types";
import { getRules } from "../domain/validation";

export function Rulebook({ onBack }: { onBack: () => void }) {
  const [scenario, setScenario] = useState<ScenarioId>("closure");
  return (
    <div className="secondary-view">
      <div className="page-heading">
        <span className="eyebrow">
          <BookOpen size={14} /> NO BLACK BOXES
        </span>
        <h1>
          Know what gets checked<span>.</span>
        </h1>
        <p>
          Every finding has a rule, an explanation, and a next step. No AI
          scores or hidden judgments.
        </p>
      </div>
      <div className="rulebook-toolbar">
        <div className="form-field">
          <label htmlFor="rulebook-scenario">Rules for scenario</label>
          <select
            id="rulebook-scenario"
            value={scenario}
            onChange={(e) => setScenario(e.target.value as ScenarioId)}
          >
            {Object.values(scenarios).map((s) => (
              <option value={s.id} key={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <button className="button button-secondary" onClick={onBack}>
          <ArrowLeft size={15} /> Back to lab
        </button>
      </div>
      <div className="panel rulebook-list">
        {getRules(scenario).map((rule) => (
          <article key={rule.id}>
            <div className={`rule-severity ${rule.severity}`}>
              {rule.severity === "error" ? (
                <CircleAlert size={18} />
              ) : rule.severity === "warning" ? (
                <TriangleAlert size={18} />
              ) : (
                <Info size={18} />
              )}
            </div>
            <div>
              <div className="rule-title">
                <h2>{rule.title}</h2>
                <code>{rule.id}</code>
                <span className="rule-badge">{rule.severity}</span>
              </div>
              <p>{rule.explanation}</p>
              <p className="rule-suggestion">{rule.suggestion}</p>
              <span className="rule-field">
                Field: {fieldLabels[rule.field]}
              </span>
            </div>
          </article>
        ))}
      </div>
      <p className="rulebook-footnote">
        Rules check field presence, basic contact syntax, and chronological
        consistency. They do not verify that a contact is reachable, a route is
        accessible, or the supplied information is true.
      </p>
    </div>
  );
}
