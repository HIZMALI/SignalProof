import {
  ArrowRight,
  Check,
  ChevronDown,
  FileText,
  LockKeyhole,
  Play,
  SlidersHorizontal,
} from "lucide-react";
import { fieldLabels, scenarios } from "../domain/scenarios";
import type {
  Draft,
  FieldKey,
  TimeInterpretation,
  ValidationResult,
} from "../domain/types";
import { TimeZoneFields } from "./TimeZoneFields";
import { Preview } from "./Preview";

export type EditorTab = "edit" | "preview";
interface Props {
  draft: Draft;
  result: ValidationResult;
  onChange: (field: FieldKey | "scenario", value: string) => void;
  onRun: () => void;
  tab: EditorTab;
  onTab: (tab: EditorTab) => void;
  storageSaved: boolean;
  onNotice: (message: string) => void;
  onTimeZone: (zone: string, interpretation?: TimeInterpretation) => void;
}

interface FieldProps {
  field: FieldKey;
  draft: Draft;
  result: ValidationResult;
  onChange: Props["onChange"];
  label?: string;
  placeholder?: string;
  multiline?: boolean;
  type?: string;
  hint?: string;
}

function Field({
  field,
  draft,
  result,
  onChange,
  label,
  placeholder,
  multiline,
  type = "text",
  hint,
}: FieldProps) {
  const required = scenarios[draft.scenario].requiredFields.includes(field);
  const failed = result.findings.find(
    (finding) =>
      finding.field === field &&
      finding.severity === "error" &&
      finding.status === "failed",
  );
  const shared = {
    id: `field-${field}`,
    name: field,
    value: draft[field],
    placeholder,
    onChange: (
      event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => onChange(field, event.target.value),
    "aria-required": required,
    "aria-invalid": !!failed,
    "aria-describedby":
      [
        hint ? `hint-${field}` : "",
        failed ? `error-${field}` : "",
        (field === "startTime" || field === "endTime") && draft[field]
          ? `time-resolution-${field}`
          : "",
      ]
        .filter(Boolean)
        .join(" ") || undefined,
    maxLength: field === "body" ? 10_000 : 2_000,
  };
  return (
    <div className={`form-field field-${field}`}>
      <label htmlFor={shared.id}>
        {label || fieldLabels[field]}
        {required ? (
          <span className="required-dot" aria-hidden="true">
            *
          </span>
        ) : (
          <span className="optional-label">Optional</span>
        )}
      </label>
      {multiline ? (
        <textarea {...shared} rows={field === "body" ? 3 : 2} />
      ) : (
        <input {...shared} type={type} />
      )}
      {hint && (
        <p className="field-hint" id={`hint-${field}`}>
          {hint}
        </p>
      )}
      {failed && (
        <p className="field-error" id={`error-${field}`}>
          Error: {failed.suggestion}
        </p>
      )}
    </div>
  );
}

export function Editor({
  draft,
  result,
  onChange,
  onRun,
  tab,
  onTab,
  storageSaved,
  onNotice,
  onTimeZone,
}: Props) {
  const scenario = scenarios[draft.scenario];
  const field = (
    key: FieldKey,
    options: Partial<
      Omit<FieldProps, "field" | "draft" | "result" | "onChange">
    > = {},
  ) => (
    <Field
      key={key}
      field={key}
      draft={draft}
      result={result}
      onChange={onChange}
      {...options}
    />
  );

  return (
    <section className="panel editor-panel" aria-label="Announcement editor">
      <div className="panel-tabs" role="tablist" aria-label="Editor view">
        <button
          id="edit-tab"
          role="tab"
          tabIndex={tab === "edit" ? 0 : -1}
          aria-selected={tab === "edit"}
          aria-controls="editor-content"
          className={tab === "edit" ? "selected" : ""}
          onClick={() => onTab("edit")}
          onKeyDown={(e) => {
            if (["ArrowRight", "ArrowLeft", "End"].includes(e.key)) {
              e.preventDefault();
              onTab("preview");
              document.getElementById("preview-tab")?.focus();
            }
          }}
        >
          <SlidersHorizontal size={16} /> Announcement editor
        </button>
        <button
          id="preview-tab"
          role="tab"
          tabIndex={tab === "preview" ? 0 : -1}
          aria-selected={tab === "preview"}
          aria-controls="editor-content"
          className={tab === "preview" ? "selected" : ""}
          onClick={() => onTab("preview")}
          onKeyDown={(e) => {
            if (["ArrowRight", "ArrowLeft", "Home"].includes(e.key)) {
              e.preventDefault();
              onTab("edit");
              document.getElementById("edit-tab")?.focus();
            }
          }}
        >
          <FileText size={16} /> Final preview
          <span className="tiny-dot" />
        </button>
      </div>
      <div
        role="tabpanel"
        id="editor-content"
        aria-labelledby={tab === "edit" ? "edit-tab" : "preview-tab"}
      >
        {tab === "preview" ? (
          <Preview draft={draft} result={result} onNotice={onNotice} />
        ) : (
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              onRun();
            }}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                e.preventDefault();
                onRun();
              }
            }}
          >
            <div className="editor-content">
              <div className="section-intro">
                <div>
                  <h2>Start with the essentials</h2>
                  <p>A little structure makes a big difference.</p>
                </div>
                <span className="step-label">01 / DRAFT</span>
              </div>
              <div className="form-field scenario-field">
                <label htmlFor="scenario">
                  Announcement scenario{" "}
                  <span className="required-dot" aria-hidden="true">
                    *
                  </span>
                </label>
                <div className="select-wrap">
                  <select
                    id="scenario"
                    value={draft.scenario}
                    onChange={(e) => onChange("scenario", e.target.value)}
                  >
                    {Object.values(scenarios).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={16} />
                </div>
              </div>
              {field("title", { placeholder: "e.g. North Gate closure" })}
              {field("audience", {
                placeholder: "Who needs to know about this?",
              })}
              {field("body", {
                multiline: true,
                placeholder: "Add context in your own words, if needed…",
                hint: "Checked facts are added to the final text automatically. Additional prose requires human review.",
              })}
              <div className="section-divider">
                <span>SCENARIO DETAILS</span>
                <span>Fields marked * are required</span>
              </div>
              {draft.scenario === "closure" && (
                <>
                  {field("location", {
                    placeholder: "e.g. North Gate, Westbridge Campus",
                  })}
                  {field("alternativeLocation", {
                    placeholder: "Which entrance should people use instead?",
                  })}
                  {field("accessibleRoute", {
                    multiline: true,
                    placeholder:
                      "Describe a step-free route or access assistance",
                  })}
                </>
              )}
              {draft.scenario === "cancellation" && (
                <>
                  {field("eventName", {
                    placeholder: "e.g. CS201 · Seminar group B",
                  })}
                  {field("location", {
                    label: "Class / event location",
                    placeholder: "Building, room, or online venue",
                  })}
                </>
              )}
              {draft.scenario === "outage" && (
                <>
                  {field("serviceName", {
                    placeholder: "e.g. Campus Wi-Fi in the Central Library",
                  })}
                  {field("location", {
                    label: "Affected location / scope",
                    placeholder: "Where is this service unavailable?",
                  })}
                  {field("workaround", {
                    multiline: true,
                    placeholder: "How can people complete their tasks?",
                  })}
                </>
              )}
              <div className="field-grid">
                {field("startTime", {
                  label: scenario.timeLabel,
                  type: "datetime-local",
                })}
                {field("endTime", {
                  label:
                    draft.scenario === "outage"
                      ? "Expected restoration"
                      : "End time",
                  type: "datetime-local",
                })}
              </div>
              <TimeZoneFields draft={draft} onChange={onTimeZone} />
              {field("action", {
                multiline: true,
                placeholder: "Tell readers exactly what they should do next",
              })}
              {field("contact", {
                placeholder: "Email, phone number, or full update URL",
              })}
              {field("reason", {
                placeholder: "Brief, verified context for the change",
              })}
              <div className="generated-note">
                <FileText size={16} />
                <p>
                  Your structured details become the final announcement.
                  <button type="button" onClick={() => onTab("preview")}>
                    See the live preview <ArrowRight size={13} />
                  </button>
                </p>
              </div>
              <a
                className="results-shortcut"
                href="#validation-results"
                onClick={(event) => {
                  event.preventDefault();
                  document.getElementById("validation-results")?.focus();
                }}
              >
                Inspect current validation results
              </a>
              <p className="field-hint">
                Checks recalculate locally as you type. Run validation to record
                and announce the result.
              </p>
            </div>
            <div className="editor-actionbar">
              <span
                className={storageSaved ? "save-status" : "save-status unsaved"}
              >
                {storageSaved ? <Check size={14} /> : <LockKeyhole size={14} />}
                {storageSaved
                  ? "Draft saved on this device"
                  : "Draft is not saved"}
              </span>
              <button className="button button-primary" type="submit">
                <Play size={15} fill="currentColor" /> Run validation{" "}
                <span className="keyboard-hint">Ctrl ↵</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
