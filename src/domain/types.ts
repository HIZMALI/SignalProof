export type ScenarioId = "closure" | "cancellation" | "outage";
export type Occurrence = "earlier" | "later";
export interface TimeInterpretation {
  mode: "iana";
  startOccurrence?: Occurrence;
  endOccurrence?: Occurrence;
}

export interface AnnouncementFields {
  title: string;
  audience: string;
  body: string;
  action: string;
  location: string;
  startTime: string;
  endTime: string;
  timeZone: string;
  alternativeLocation: string;
  accessibleRoute: string;
  contact: string;
  eventName: string;
  serviceName: string;
  workaround: string;
  reason: string;
}

export type FieldKey = keyof AnnouncementFields;
export interface Draft extends AnnouncementFields {
  scenario: ScenarioId;
  timeInterpretation?: TimeInterpretation;
}

export type Severity = "error" | "warning" | "informational";
export interface ValidationRule {
  id: string;
  title: string;
  severity: Severity;
  field: FieldKey;
  explanation: string;
  suggestion: string;
  passes: (draft: Draft) => boolean;
}

export interface Finding extends Omit<ValidationRule, "passes"> {
  status: "passed" | "failed";
}

export type ValidationStatus =
  "needs-attention" | "review-needed" | "checks-passed";
export interface ValidationResult {
  status: ValidationStatus;
  findings: Finding[];
  errorCount: number;
  warningCount: number;
  passedCount: number;
  completeness: number;
  completedFields: number;
  requiredFields: number;
  finalAnnouncement: string;
}

export interface ValidationRun {
  id: string;
  timestamp: string;
  draft: Draft;
  result: ValidationResult;
}

export interface Scenario {
  id: ScenarioId;
  label: string;
  shortLabel: string;
  description: string;
  timeLabel: string;
  requiredFields: FieldKey[];
}
