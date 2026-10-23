import { generateAnnouncement } from "./announcement";
import { resolveTime, validZone } from "./timeZone";
import { scenarios } from "./scenarios";
import type {
  Draft,
  FieldKey,
  ValidationResult,
  ValidationRule,
} from "./types";

export function hasValue(value: string): boolean {
  const trimmed = value.trim();
  return (
    trimmed.length > 0 &&
    !/^(tbd|tbc|n\/?a|none|unknown|later|[?.\-]+|\[.*\])$/i.test(trimmed)
  );
}

export function hasContactRoute(value: string): boolean {
  return (
    hasValue(value) &&
    (/\b[^\s@]+@[^\s@]+\.[a-z]{2,}\b/i.test(value) ||
      /https?:\/\/[^\s.]+(?:\.[^\s.]+)+/i.test(value) ||
      /\+?[\d(][\d\s().-]{6,}\d/.test(value))
  );
}

function required(
  id: string,
  field: FieldKey,
  title: string,
  explanation: string,
  suggestion: string,
): ValidationRule {
  return {
    id,
    field,
    title,
    severity: "error",
    explanation,
    suggestion,
    passes: (draft) => hasValue(draft[field]),
  };
}

const commonRules: ValidationRule[] = [
  required(
    "CORE-01",
    "title",
    "A clear announcement title",
    "The final announcement needs a title so readers can identify its purpose.",
    "Add a specific title that identifies the change.",
  ),
  required(
    "CORE-02",
    "audience",
    "Target audience identified",
    "Readers need to know whether this announcement applies to them.",
    "Name the affected students, staff, visitors, or service users.",
  ),
  required(
    "CORE-03",
    "action",
    "A concrete next step",
    "This scenario requires an explicit action in the final announcement.",
    "Tell readers exactly what to do next, even if no action is needed.",
  ),
  {
    id: "CORE-04",
    field: "startTime",
    title: "An exact effective time",
    severity: "error",
    explanation:
      "A valid calendar date, local time and explicit zone are required. Named-zone gaps are invalid; repeated times require an occurrence choice.",
    suggestion:
      "Set the exact date and time, resolve the zone, and choose an occurrence if the clock time repeats.",
    passes: (draft) => resolveTime(draft, "startTime").status === "valid",
  },
  {
    id: "CORE-05",
    field: "timeZone",
    title: "Explicit time zone is valid",
    severity: "error",
    explanation:
      "Choose a supported named IANA zone, or explicitly supply a fixed UTC offset. Device-local time is never assumed.",
    suggestion:
      "Use the time zone controls. Legacy labels need an explicit offset such as London (UTC+00:00).",
    passes: validZone,
  },
  {
    id: "CORE-06",
    field: "contact",
    title: "A reachable verification source",
    severity: "error",
    explanation:
      "Readers need a contact route or an update source. A name alone is insufficient.",
    suggestion:
      "Include an email address, phone number, or full https:// update URL.",
    passes: (draft) => hasContactRoute(draft.contact),
  },
  {
    id: "CORE-07",
    field: "endTime",
    title: "Time range is consistent",
    severity: "error",
    explanation:
      "If an end time is provided, its resolved instant must be after the start, including any daylight-saving offset change.",
    suggestion:
      "Choose an end instant after the start. Resolve repeated times explicitly, or leave the end blank if unknown.",
    passes: (draft) => {
      if (!draft.endTime.trim()) return true;
      const start = resolveTime(draft, "startTime").selected;
      const end = resolveTime(draft, "endTime").selected;
      return (
        start !== null &&
        end !== null &&
        end.epochMilliseconds > start.epochMilliseconds
      );
    },
  },
  {
    id: "CORE-08",
    field: "body",
    title: "Additional prose needs human review",
    severity: "warning",
    explanation:
      "The rules check structured facts. They cannot detect contradictions, misleading claims, or unclear language in additional context.",
    suggestion:
      "Review the context against every structured fact in the final preview, or remove redundant context.",
    passes: (draft) => !draft.body.trim(),
  },
  {
    id: "CORE-09",
    field: "title",
    title: "Structured facts included in final text",
    severity: "informational",
    explanation:
      "The final preview is regenerated from the checked fields on every edit. Free-text context is separately marked for review.",
    suggestion:
      "Copy or download the generated final announcement, then obtain the appropriate human approval.",
    passes: () => true,
  },
];

const scenarioRules: Record<Draft["scenario"], ValidationRule[]> = {
  closure: [
    required(
      "CLOSURE-01",
      "location",
      "Affected entrance identified",
      "A closure must identify the entrance or location that is unavailable.",
      "Name the closed entrance and campus or building.",
    ),
    required(
      "CLOSURE-02",
      "alternativeLocation",
      "An alternative entrance",
      "People need an explicit alternative route while the entrance is closed.",
      "Add the alternative entrance and directions to reach it.",
    ),
    {
      id: "CLOSURE-03",
      field: "accessibleRoute",
      title: "Accessible route described",
      severity: "warning",
      explanation:
        "An alternative entrance is not automatically accessible. Readers may need step-free route information.",
      suggestion:
        "Describe the step-free route, or give a contact for access assistance. Verify it on site.",
      passes: (draft) => hasValue(draft.accessibleRoute),
    },
    {
      id: "CLOSURE-04",
      field: "endTime",
      title: "Closure end time provided",
      severity: "warning",
      explanation:
        "An end time helps readers plan their return. If it is unknown, the action should explain where to get updates.",
      suggestion: "Add the expected reopening date and time when confirmed.",
      passes: (draft) => resolveTime(draft, "endTime").status === "valid",
    },
  ],
  cancellation: [
    required(
      "CANCEL-01",
      "eventName",
      "The cancelled class or event",
      "A cancellation must name the exact class or event, including a section if relevant.",
      "Add the class code, event name, or session identifier.",
    ),
    {
      id: "CANCEL-02",
      field: "reason",
      title: "A reason for the cancellation",
      severity: "warning",
      explanation:
        "A concise reason can reduce uncertainty. Do not include private or unverified details.",
      suggestion: "Add a short, verified reason if appropriate to share.",
      passes: (draft) => hasValue(draft.reason),
    },
  ],
  outage: [
    required(
      "OUTAGE-01",
      "serviceName",
      "The affected service",
      "An outage must identify the unavailable service or system.",
      "Name the service, system, or facility affected by this outage.",
    ),
    {
      id: "OUTAGE-02",
      field: "workaround",
      title: "A workaround for users",
      severity: "warning",
      explanation:
        "People may need another way to complete essential tasks while the service is unavailable.",
      suggestion:
        "Describe an available alternative, or explicitly explain that no workaround is available.",
      passes: (draft) => hasValue(draft.workaround),
    },
    {
      id: "OUTAGE-03",
      field: "endTime",
      title: "Expected restoration time",
      severity: "warning",
      explanation:
        "A restoration estimate helps users plan. It should be clearly described as an estimate.",
      suggestion:
        "Add an expected restoration time when confirmed, or explain the update schedule in the action.",
      passes: (draft) => resolveTime(draft, "endTime").status === "valid",
    },
  ],
};

export function getRules(scenario: Draft["scenario"]): ValidationRule[] {
  return [...commonRules, ...scenarioRules[scenario]];
}

export function validateAnnouncement(draft: Draft): ValidationResult {
  const findings = getRules(draft.scenario).map(({ passes, ...rule }) => ({
    ...rule,
    status: passes(draft) ? ("passed" as const) : ("failed" as const),
  }));
  const errorCount = findings.filter(
    (f) => f.status === "failed" && f.severity === "error",
  ).length;
  const warningCount = findings.filter(
    (f) => f.status === "failed" && f.severity === "warning",
  ).length;
  const requiredFields = scenarios[draft.scenario].requiredFields;
  const completedFields = requiredFields.filter((field) =>
    hasValue(draft[field]),
  ).length;
  return {
    findings,
    errorCount,
    warningCount,
    status: errorCount
      ? "needs-attention"
      : warningCount
        ? "review-needed"
        : "checks-passed",
    passedCount: findings.filter((f) => f.status === "passed").length,
    completeness: Math.round((completedFields / requiredFields.length) * 100),
    completedFields,
    requiredFields: requiredFields.length,
    finalAnnouncement: generateAnnouncement(draft),
  };
}
