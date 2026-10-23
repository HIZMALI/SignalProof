import type { Draft, FieldKey, Scenario, ScenarioId } from "./types";

const common: FieldKey[] = [
  "title",
  "audience",
  "action",
  "startTime",
  "timeZone",
  "contact",
];

export const scenarios: Record<ScenarioId, Scenario> = {
  closure: {
    id: "closure",
    label: "Campus entrance closure",
    shortLabel: "Entrance closure",
    description: "Help people find their way when an entrance is unavailable.",
    timeLabel: "Closure starts",
    requiredFields: [...common, "location", "alternativeLocation"],
  },
  cancellation: {
    id: "cancellation",
    label: "Class or event cancellation",
    shortLabel: "Cancellation",
    description: "Make it clear what is cancelled and what happens next.",
    timeLabel: "Scheduled class / event time",
    requiredFields: [...common, "eventName"],
  },
  outage: {
    id: "outage",
    label: "Service outage",
    shortLabel: "Service outage",
    description:
      "Explain what is unavailable and how people can work around it.",
    timeLabel: "Outage starts",
    requiredFields: [...common, "serviceName"],
  },
};

export const fieldLabels: Record<FieldKey, string> = {
  title: "Announcement title",
  audience: "Target audience",
  body: "Additional context",
  action: "Required action",
  location: "Affected entrance / location",
  startTime: "Effective time",
  endTime: "End / restoration time",
  timeZone: "Time zone",
  alternativeLocation: "Alternative entrance",
  accessibleRoute: "Accessible route details",
  contact: "Contact or verification source",
  eventName: "Affected class or event",
  serviceName: "Affected service",
  workaround: "Workaround or alternative",
  reason: "Reason",
};

export function createEmptyDraft(scenario: ScenarioId = "closure"): Draft {
  return {
    scenario,
    title: "",
    audience: "",
    body: "",
    action: "",
    location: "",
    startTime: "",
    endTime: "",
    timeZone: "",
    alternativeLocation: "",
    accessibleRoute: "",
    contact: "",
    eventName: "",
    serviceName: "",
    workaround: "",
    reason: "",
  };
}
