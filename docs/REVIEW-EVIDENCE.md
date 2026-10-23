# Review & Evidence Lab

SignalProof records what the deterministic engine checked and what a human explicitly acknowledged. Completion is a self-attestation, never permission to send, a verified identity, or a safety certificate. Processing stays in the browser after the static application loads; initial loading and reloading require the site files.

## Architecture

`src/domain/evidence/` records the independently versioned source/channel engines. `snapshot.ts` captures source validation, all three channel evaluations, semantic coverage, required source facts, settings, timezone interpretation/assumptions and ruleset version. `comparison.ts` calculates field and finding differences. `review.ts` enforces manual response requirements. `report.ts` creates portable JSON and plain text. React components in `src/components/evidence/` expose those operations; `src/lib/evidenceStorage.ts` owns defensive parsing, persistence and merge behavior.

Snapshot records are recursively frozen in memory. Restoring copies source fields and channel options, then runs current validation; it never edits the historical record. Reports show **recorded** results and expose a separately labeled current-rule recomputation. Recomputing historical evidence creates a new ID and timestamp and transfers no review responses.

### Canonical binding

The exact binding includes every source field, generated title/body/reference spans, channel results/coverage, options, required facts, assumptions and ruleset version. Canonical serialization sorts object keys, retains array order, uses JSON string escaping, accepts finite numbers and JSON primitives, and rejects undefined/non-JSON values. IDs, record timestamps, navigation, scrolling and expanded panels are excluded.

Review applicability compares this canonical string directly. Browser Web Crypto optionally displays its SHA-256 digest in a report; there is no asynchronous hash dependency in completion or invalidation. The digest is a **local content fingerprint**, not a digital signature or tamper-proof guarantee.

Editing action, time, contact, scenario or other fields, changing push preset/order, or toggling SMS cutoff changes the binding. Navigation, channel selection and expanding explanations do not. A visible re-review notice appears when no completed record matches the working content. Exact reversion to previously reviewed content can make that original review applicable again. Historical records remain associated with their original snapshot.

## Time interpretation

`src/domain/timeZone.ts` supplies the shared interpretation used by source validation, announcements and channel payloads. `wallTime.ts` parses minute-level Gregorian dates independently of the viewer's local time zone. The pinned Temporal polyfill uses the browser's Intl time zone data without a network lookup.

The editor supports named IANA zones and explicit fixed UTC offsets. It never guesses a location from the device zone. Each endpoint resolves separately, including intervals spanning an offset change.

- A nonexistent local time is rejected without shifting it, such as `2026-03-08 02:30` in `America/New_York`.
- A repeated local time requires an explicit earlier/later occurrence for that endpoint, such as `2026-11-01 01:30` in `America/New_York`. Editing the endpoint or zone resets that selection.
- Ranges compare resolved instants. A fall-transition interval from `01:50 UTC-04:00` to `01:10 UTC-05:00` is valid and lasts 20 minutes; equal or reversed instants fail.
- Legacy labels with an explicit offset remain fixed-offset interpretations. They are never silently converted to a named zone.

The current ruleset is `source-2.0/channel-2.0/review-1.0/time-1.0`, with channel templates `2.1`. Snapshots retain the interpretation, engine identifier, offsets, instants and exact results. Browser/OS time zone databases can change, so a future recomputation can differ; recorded results remain intact. There is no bundled frozen time zone database.

## Storage and migration

| Storage                   | Contract                                                                                                                                                   |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `signalproof.draft.v1`    | Preserved legacy `{ version: 1, draft }`; read when v2 is absent.                                                                                          |
| `signalproof.draft.v2`    | Active version-2 draft, with optional explicit IANA/occurrence metadata.                                                                                   |
| `signalproof.evidence.v1` | Preserved legacy container, validated/read when v2 is absent.                                                                                              |
| `signalproof.evidence.v2` | Active `{ kind: "signalproof-evidence", version: 2, revision, snapshots, reviews }`.                                                                       |
| Snapshot                  | Original `schemaVersion: 1` or new `2`, ID, local timestamp, origin, source, results, all channels/options/assumptions and canonical binding.              |
| Review                    | ID, snapshot ID and exact canonical binding, local timestamp, status, reviewer-provided name/role, checklist, notes and explicit warning acknowledgements. |

Legacy v1 data has an explicit validated migration. A draft autosave writes a separate v2 copy, leaving its v1 bytes intact. Evidence loads the v1 container into a version-2 in-memory store and writes v2 only on a record/import operation. Original snapshot/review objects, keys and rules labels are retained unchanged. Unknown/corrupt active evidence is preserved and locked; raw download supports either key. Confirmed clear removes active and preserved legacy evidence, while both draft keys remain untouched. Imported reports use a different schema and cannot be mistaken for backups.

Retention is **50 newest snapshots** and **200 review records**, with **400,000 characters per snapshot**, **2,000,000 total serialized characters** and a **4,000,000-byte import file cap**. Recording beyond 50 evicts the oldest snapshot and its linked reviews. Reaching review/size limits rejects the new addition with guidance; it does not silently trim review responses. Imports never evict records to fit. JSON backup uses compact serialization so an exported store fits its own import character budget.

The size bound can be reached before the count bound; 50 snapshots/200 reviews are maxima rather than guaranteed disk capacity for large records. Exact canonical bindings contribute to that storage overhead.

The parser validates supported enums, IDs, timestamps, bounded strings/arrays, source fields, nested findings, count/status consistency, channel references, SMS accounting, required facts, options, assumptions, review binding and completion prerequisites. Canonical consistency is checked without replacing recorded results with a current engine evaluation. Historical ruleset results remain historical, including imported data; structural validity does not establish authenticity.

A complete store is written with one LocalStorage `setItem`, avoiding partial multi-key updates. Failed writes leave disk contents intact, keep accepted records in memory, and display a visible export warning. Oversized or invalid records are rejected before entering the active store. There is no crash-proof filesystem transaction or guaranteed browser durability.

Revision checks reject a detected conflicting write. A cross-tab storage event locks writes and prompts backup/reload. LocalStorage offers no atomic compare-and-swap, so a truly simultaneous cross-tab race cannot be fully prevented; use one editing tab. Browser-local evidence can be edited externally, cleared or lost.

## Comparison

Any two retained snapshots can be selected, including reversed order, identical snapshots and different scenarios. Every source field is compared by exact value. Outstanding findings are matched by **scope + rule ID + severity**. Disappearing IDs resolve, new IDs are introduced, matching IDs remain unresolved; a severity change is one resolved and one introduced issue. Matching IDs may still have changed explanations, available in each snapshot's report. Required source values/states and per-channel coverage/visibility differences are shown. Different rulesets are disclosed. No chronological improvement assumption or safety percentage is used.

Named-zone occurrence/mode changes are included as human-readable changes in the time-zone field, independent of object key order. New schema-2 assumptions retain the Temporal engine identifier and resolved start/end offsets/instants. Historical schema-1 reports label legacy interpretation instead of retroactively assigning an IANA zone. A ruleset update requires a new eligible review even if the source fields happen to match.

Push visibility findings are grouped for presentation only. Action, effective time/time zone, affected place/service/event and alternative-location concerns appear first; ordinary collapsed-card limitations remain expandable. The original IDs, severities, source errors, coverage matrix and counts are unchanged. Expanding the device sample does not remove collapsed-visibility findings.

## Human review rules

Manual review shows the exact recorded source and all channel payloads, including the collapsed push sample. Eight explicit checks cover facts, time, action, contact, audience, physical access, human authority judgment and channel inspection. Physical access is conditional on the closure scenario (seven checks otherwise).

Completed self-attestation requires a reviewer-provided display name, every applicable manual check and an explicit acknowledgement of **each** outstanding source/channel warning. Optional acknowledgement notes preserve exceptions. Source/channel errors, a loss-test cutoff, or a historical evaluation that no longer matches current rules block completion. Incomplete observations are allowed and never presented as completed review. The app does not verify the source, person's identity or authority.

Name/role are capped at 120 characters each; review notes at 3,000; supporting reference at 2,000; each acknowledgement note at 500. Form responses persist only when the user records observations or completes review. There is no silent autosave of an unrecorded review form. Snapshot switching/navigation can discard those unrecorded responses; this is stated beside the form.

Demo snapshots are created from the original incomplete and corrected fixtures using the actual engines, marked illustrative, and leave the working draft unchanged. They never fabricate checklist answers, reviewer names, acknowledgements or completed activity.

## Reports, backup and untrusted text

The on-screen report includes source facts/findings, exact source and channel payloads, SMS units/segments, push assumptions/visibility, email subject/body, comparison changes, human responses, applicability and limitations. Print uses a light A4 stylesheet; `beforeprint` expands full details and `afterprint` restores the screen state. Browser **Print / Save as PDF** delegates to the browser; pagination can vary by browser/printer.

Report JSON (`kind: "signalproof-report", version: 1`) contains the selected snapshot, comparison snapshots/differences when selected, associated reviews/applicability, optional local fingerprint and limitations. Plain-text summary includes exact counts and outstanding findings. Backup JSON uses the evidence store schema, preserving snapshots and review records for reimport; it is distinct from report JSON.

Import checks the entire nested store, previews its merge and requires confirmation. Identical IDs/content are skipped; any conflicting ID rejects the entire import. Merge does not replace current draft or existing evidence. Clearing evidence also requires confirmation and preserves the working draft. These are local product confirmation flows, not identity or authorization checks.

React renders user and imported text as text nodes; no `innerHTML`, HTML export or executable import is used. JSON download uses Blob URLs, filename sanitization and URL revocation. No external links are automatically followed. Records and review notes are unencrypted; avoid confidential information in shared browsers.

## Limits

There is no sending, backend, analytics, cloud sync, authentication or identity/signature service. Simulations approximate channel behavior. Facts, contact reachability, accessibility, supplied UTC offsets, sender authority, provider acceptance and delivery remain unverified. The local device supplies all timestamps. Automated accessibility checks and viewport testing do not constitute assistive-technology, real-device or safety certification.

See [testing and coverage](QA.md) and the [published demo](https://www.youtube.com/watch?v=WSou-0mDPkg).
