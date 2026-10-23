import type {
  ChannelAnalysisResult,
  ChannelOptions,
  ChannelType,
} from "../channels/types";
import type { Draft, FieldKey, ValidationRun } from "../types";

export const RULESET_VERSION = "source-2.0/channel-2.0/review-1.0/time-1.0";
export const MAX_SNAPSHOTS = 50;
export const MAX_REVIEWS = 200;
export const CHANNELS: ChannelType[] = ["sms", "push", "email"];
export interface SimulationAssumptions {
  templateVersion: "2.0" | "2.1";
  timeZoneData?: {
    engine: string;
    mode: "iana" | "fixed";
    zone: string;
    start: { instant: string; offset: string } | null;
    end: { instant: string; offset: string } | null;
  };
  smsSingle: [160, 70];
  smsMultipart: [153, 67];
  pairPreservation: true;
  pushBudget: { title: number; body: number };
  emailBudget: { title: 60; body: 120 };
  clock: "local-device";
}
export type RecordedChannel = Omit<ChannelAnalysisResult, "source">;
export interface RequiredFact {
  field: FieldKey;
  label: string;
  value: string;
  state: "valid" | "missing" | "invalid";
}
export interface EvidenceSnapshot extends ValidationRun {
  schemaVersion: 1 | 2;
  rulesetVersion: string;
  origin: "recorded" | "demo";
  options: ChannelOptions;
  assumptions: SimulationAssumptions;
  requiredFacts: RequiredFact[];
  channels: Record<ChannelType, RecordedChannel>;
  contentKey: string;
}
export type ChecklistId =
  | "facts"
  | "time"
  | "action"
  | "contact"
  | "audience"
  | "access"
  | "authority"
  | "channels";
export interface ManualChecklistItem {
  id: ChecklistId;
  label: string;
}
export interface ReviewForm {
  name: string;
  role: string;
  notes: string;
  evidenceNote: string;
  checklist: Partial<Record<ChecklistId, boolean>>;
  acknowledgements: Record<string, { acknowledged: boolean; note: string }>;
}
export interface ReviewRecord extends ReviewForm {
  id: string;
  snapshotId: string;
  contentKey: string;
  recordedAt: string;
  status: "observations" | "completed";
}
export interface EvidenceStore {
  kind: "signalproof-evidence";
  version: 2;
  revision: number;
  snapshots: EvidenceSnapshot[];
  reviews: ReviewRecord[];
}
export interface ReviewIssue {
  key: string;
  scope: "source" | ChannelType;
  id: string;
  title: string;
  severity: "error" | "warning";
  field?: FieldKey;
  explanation: string;
  suggestion: string;
  priority: "critical" | "general";
}
export interface Evaluation {
  draft: Draft;
  result: EvidenceSnapshot["result"];
  channels: EvidenceSnapshot["channels"];
  options: ChannelOptions;
  assumptions: SimulationAssumptions;
  requiredFacts: RequiredFact[];
  rulesetVersion: string;
}
