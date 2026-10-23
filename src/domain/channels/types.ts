import type {
  Draft,
  FieldKey,
  Severity,
  ValidationResult,
  ValidationStatus,
} from "../types";

export type ChannelType = "sms" | "push" | "email";
export interface FactReference {
  field: FieldKey;
  sourceValue: string;
  renderedValue: string;
  start: number;
  end: number;
}
export interface MessagePart {
  text: string;
  references: FactReference[];
}
export interface ChannelPayload {
  channel: ChannelType;
  title: MessagePart;
  body: MessagePart;
}
export type CoverageStatus =
  "represented" | "source-missing" | "source-invalid" | "omitted";
export type VisibilityStatus = "visible" | "partial" | "hidden" | "unavailable";
export interface RequiredFactCoverage {
  field: FieldKey;
  status: CoverageStatus;
  collapsedVisibility: VisibilityStatus;
}
export interface ChannelFinding {
  id: string;
  title: string;
  severity: Severity;
  channel: ChannelType;
  field?: FieldKey;
  explanation: string;
  suggestion: string;
  status: "passed" | "failed";
}
export interface SmsMetrics {
  encoding: "GSM-7" | "UCS-2 / UTF-16";
  characters: number;
  units: number;
  unitLabel: "septets" | "UTF-16 code units";
  extensionCharacters: number;
  nonGsmCharacters: string[];
  singleSegmentLimit: number;
  multipartSegmentLimit: number;
  segments: number;
  segmentUnits: number[];
}
export type PushPresetId = "compact" | "roomy";
export type PushOrder = "action-first" | "details-first";
export interface ChannelOptions {
  smsCutoff: boolean;
  pushPreset: PushPresetId;
  pushOrder: PushOrder;
}
export interface ChannelPreview {
  title: string;
  body: string;
  titleVisibleEnd: number;
  bodyVisibleEnd: number;
  truncated: boolean;
}
export interface ChannelMetrics {
  titleCharacters: number;
  bodyCharacters: number;
  sms?: SmsMetrics;
}
export interface ChannelAnalysisResult {
  payload: ChannelPayload;
  preview: ChannelPreview;
  metrics: ChannelMetrics;
  coverage: RequiredFactCoverage[];
  findings: ChannelFinding[];
  status: ValidationStatus;
  overallStatus: ValidationStatus;
  errorCount: number;
  warningCount: number;
  representedCount: number;
  source: ValidationResult;
}
export interface ChannelLabProps {
  draft: Draft;
  selected: ChannelType;
  options: ChannelOptions;
  onOptions: (options: ChannelOptions) => void;
  onSelect: (channel: ChannelType) => void;
  onEdit: (field?: FieldKey) => void;
  onNotice: (message: string) => void;
}
