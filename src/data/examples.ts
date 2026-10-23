import { createEmptyDraft } from "../domain/scenarios";
import type { Draft } from "../domain/types";

export interface DemoExample {
  id: string;
  label: string;
  description: string;
  draft: Draft;
}

const incompleteClosure: Draft = {
  ...createEmptyDraft("closure"),
  title: "North Gate closure",
  audience: "All students, faculty, staff, and campus visitors",
  location: "North Gate, Westbridge Campus",
  timeZone: "London (UTC+00:00)",
  contact: "Campus Operations · operations@westbridge.example",
};

const correctedClosure: Draft = {
  ...incompleteClosure,
  action:
    "Use the East Gate on University Road. Allow 10 extra minutes for your journey.",
  startTime: "2026-11-02T08:00",
  endTime: "2026-11-02T18:00",
  alternativeLocation:
    "East Gate, University Road, 200 m east of the North Gate",
  accessibleRoute:
    "Use the step-free East Gate entrance and follow the signed, level path to the main quad. Contact Campus Operations for assistance.",
  reason: "Scheduled gate maintenance",
};

export const examples: DemoExample[] = [
  {
    id: "closure-incomplete",
    label: "Incomplete closure",
    description: "Find the missing essentials",
    draft: incompleteClosure,
  },
  {
    id: "closure-corrected",
    label: "Corrected closure",
    description: "See every applicable check pass",
    draft: correctedClosure,
  },
  {
    id: "cancellation",
    label: "Class cancellation",
    description: "Test a different scenario",
    draft: {
      ...createEmptyDraft("cancellation"),
      title: "CS201 seminar cancelled — 3 November",
      audience: "Students enrolled in CS201, seminar group B",
      eventName: "CS201 · Seminar group B",
      startTime: "2026-11-03T14:00",
      timeZone: "London (UTC+00:00)",
      action:
        "Do not attend the seminar. Complete worksheet 4 on the course portal before the next scheduled class.",
      location: "Room 204, Computing Building",
      reason: "Urgent room maintenance",
      contact: "Course Office · cs201@westbridge.example",
    },
  },
  {
    id: "outage",
    label: "Service outage",
    description: "Review an IT service interruption",
    draft: {
      ...createEmptyDraft("outage"),
      title: "Campus Wi-Fi maintenance",
      audience: "Students and staff in the Central Library",
      serviceName: "Campus Wi-Fi in the Central Library",
      startTime: "2026-11-04T06:00",
      endTime: "2026-11-04T08:00",
      timeZone: "London (UTC+00:00)",
      action:
        "Save your work before 06:00. Use a wired workstation during maintenance and check the status page for updates.",
      location: "Central Library, all floors",
      workaround:
        "Wired library workstations and Wi-Fi in the Student Centre remain available.",
      contact: "IT Service Desk · https://status.westbridge.example",
      reason: "Scheduled network upgrades",
    },
  },
];

export function getInitialDraft(): Draft {
  return { ...incompleteClosure };
}
