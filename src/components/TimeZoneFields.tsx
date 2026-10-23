import {
  COMMON_ZONES,
  fixedOffset,
  resolveTime,
  timeProblem,
  validZone,
} from "../domain/timeZone";
import type { Draft, TimeInterpretation } from "../domain/types";

export function TimeZoneFields({
  draft,
  onChange,
}: {
  draft: Draft;
  onChange: (zone: string, interpretation?: TimeInterpretation) => void;
}) {
  const named = !!draft.timeInterpretation;
  const zoneValid = validZone(draft);
  return (
    <fieldset className="time-zone-controls">
      <legend>Time interpretation</legend>
      <div className="form-field">
        <label htmlFor="time-zone-mode">Time zone mode</label>
        <select
          id="time-zone-mode"
          value={named ? "iana" : "fixed"}
          onChange={(event) => {
            const interpretation =
              event.target.value === "iana"
                ? { mode: "iana" as const }
                : undefined;
            const compatible = interpretation
              ? validZone({ ...draft, timeInterpretation: interpretation })
              : fixedOffset(draft.timeZone) !== null;
            onChange(compatible ? draft.timeZone : "", interpretation);
          }}
        >
          <option value="fixed">
            Manual fixed UTC offset (legacy compatible)
          </option>
          <option value="iana">Named IANA time zone (date-aware)</option>
        </select>
      </div>
      <div className="form-field">
        <label htmlFor="field-timeZone">
          Time zone <span aria-hidden="true">*</span>
        </label>
        <input
          id="field-timeZone"
          name="timeZone"
          aria-required="true"
          aria-invalid={!zoneValid}
          aria-describedby={`time-zone-hint${zoneValid ? "" : " error-timeZone"}`}
          value={draft.timeZone}
          maxLength={2000}
          list={named ? "iana-zones" : undefined}
          placeholder={
            named ? "e.g. America/New_York" : "e.g. London (UTC+00:00)"
          }
          onChange={(e) =>
            onChange(e.target.value, named ? { mode: "iana" } : undefined)
          }
        />
        {named && (
          <datalist id="iana-zones">
            {COMMON_ZONES.map((zone) => (
              <option key={zone} value={zone} />
            ))}
          </datalist>
        )}
        <p className="field-hint" id="time-zone-hint">
          {named
            ? "Use a supported IANA identifier. Offsets resolve separately for each date. Repeated times require an explicit occurrence."
            : "Enter an explicit UTC±HH:MM offset. It stays fixed for both times; no daylight-saving transition is inferred. Existing labels are preserved."}{" "}
          Device-local time is never assumed.
        </p>
        {!zoneValid && (
          <p className="field-error" id="error-timeZone">
            Error:{" "}
            {named
              ? "Enter a supported IANA identifier, such as America/New_York."
              : "Enter one explicit fixed offset, such as UTC+03:00. A place name alone is insufficient."}
          </p>
        )}
      </div>
      {(["startTime", "endTime"] as const).map((endpoint) => {
        if (!draft[endpoint] && endpoint === "endTime") return null;
        const result = resolveTime(draft, endpoint);
        const key =
          endpoint === "startTime" ? "startOccurrence" : "endOccurrence";
        return (
          <div
            className={`time-resolution ${result.status === "valid" ? "" : "invalid"}`}
            key={endpoint}
            id={`time-resolution-${endpoint}`}
          >
            <strong>
              {endpoint === "startTime" ? "Start" : "End"} interpretation
            </strong>
            <p>
              {result.selected
                ? `${draft[endpoint].replace("T", " ")} · ${named ? draft.timeZone : "Fixed offset"} · UTC${result.selected.offset} · instant ${result.selected.instant}`
                : timeProblem(result)}
            </p>
            {result.candidates.length === 2 && (
              <div className="form-field">
                <label htmlFor={`occurrence-${endpoint}`}>
                  {endpoint === "startTime" ? "Start" : "End"} occurrence
                </label>
                <select
                  id={`occurrence-${endpoint}`}
                  value={draft.timeInterpretation?.[key] ?? ""}
                  aria-required="true"
                  aria-invalid={!result.selected}
                  onChange={(e) => {
                    const interpretation = { ...draft.timeInterpretation! };
                    if (
                      e.target.value === "earlier" ||
                      e.target.value === "later"
                    )
                      interpretation[key] = e.target.value;
                    else delete interpretation[key];
                    onChange(draft.timeZone, interpretation);
                  }}
                >
                  <option value="">Choose an occurrence…</option>
                  {result.candidates.map((candidate, index) => (
                    <option
                      key={candidate.instant}
                      value={index ? "later" : "earlier"}
                    >
                      {index ? "Later" : "Earlier"} · UTC{candidate.offset} ·{" "}
                      {candidate.instant}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        );
      })}
    </fieldset>
  );
}
