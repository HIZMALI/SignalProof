import { performance } from "node:perf_hooks";
import { mkdirSync, writeFileSync } from "node:fs";
import { examples } from "../src/data/examples";
import {
  createSnapshot,
  emptyEvidence,
  evaluateEvidence,
} from "../src/domain/evidence/snapshot";
import { emptyReviewForm, recordReview } from "../src/domain/evidence/review";
import {
  appendReview,
  appendSnapshot,
  MAX_HISTORY_CHARS,
  parseEvidence,
} from "../src/lib/evidenceStorage";

const draft = {
  ...examples[1].draft,
  timeZone: "America/New_York",
  timeInterpretation: { mode: "iana" as const },
  startTime: "2026-07-01T10:00",
  endTime: "2026-07-01T12:00",
};
function sample(operation: () => unknown, count = 100) {
  const timings = Array.from({ length: count }, () => {
    const start = performance.now();
    operation();
    return performance.now() - start;
  }).sort((a, b) => a - b);
  return {
    medianMs: timings[Math.floor(count / 2)],
    p95Ms: timings[Math.floor(count * 0.95)],
  };
}
let data = emptyEvidence();
for (let i = 0; i < 50; i++)
  data = appendSnapshot(
    data,
    createSnapshot(draft, undefined, {
      id: `stress-snapshot-${i}`,
      timestamp: "2026-10-23T10:00:00.000Z",
    }),
  );
const snapshot = data.snapshots[0];
const retainedInMemory = data.snapshots.length;
// The total byte/character bound can be reached before the record-count bound.
while (JSON.stringify(data).length > 1_850_000)
  data = { ...data, snapshots: data.snapshots.slice(0, -1) };
while (data.reviews.length < 199) {
  const record = recordReview(
    snapshot,
    {
      ...emptyReviewForm(),
      name: "Fictional performance fixture",
      notes: "Automated observation; no facts verified.",
    },
    "observations",
    {
      id: `stress-review-${data.reviews.length}`,
      timestamp: "2026-10-23T10:01:00.000Z",
    },
  ).record!;
  const next = appendReview(data, record);
  if (JSON.stringify(next).length > MAX_HISTORY_CHARS) break;
  data = next;
}
const raw = JSON.stringify(data);
mkdirSync(".qa", { recursive: true });
if (!parseEvidence(raw).data)
  throw new Error("Performance fixture must pass the actual defensive parser.");
const results = {
  evaluation: sample(() => evaluateEvidence(draft)),
  parseNearLimit: sample(() => parseEvidence(raw), 20),
  retainedInMemory,
  snapshots: data.snapshots.length,
  reviews: data.reviews.length,
  storageCharacters: raw.length,
};
writeFileSync(".qa/stress-evidence.json", raw);
writeFileSync(".qa/domain-profile.json", JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
