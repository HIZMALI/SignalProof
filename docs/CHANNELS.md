# Channel architecture and simulation contract

Channel Lab tests how the same structured announcement is represented in SMS, a generic push notification, and email. It never sends messages, establishes sender identity, verifies real-world facts, or authorizes publication.

## Pure domain pipeline

The modules in `src/domain/channels/` are separate from React and browser persistence:

1. `generateChannelPayload` creates title/body `MessagePart` values. Each contains text plus semantic `FactReference` spans recording a source field/value, expected rendered value, and UTF-16 start/end offsets.
2. `calculateChannelMetrics` and `calculateSmsMetrics` measure the actual generated text.
3. `generateChannelPreview` clips only the visible push/inbox sample. The full payload is preserved.
4. `verifyRequiredFactCoverage` verifies source presence/format, current source value, expected rendering, valid offsets, and the actual text at the referenced span. A matching word elsewhere is not evidence. Reformatted dates retain references without requiring raw ISO strings to appear in the output.
5. `analyzeChannelPayload` produces stable channel findings, source validation, channel status, and a conservative `overallStatus`. `analyzeChannel` runs the pipeline for a channel from the current draft.

`ChannelPayload`, `ChannelPreview`, `ChannelFinding`, `ChannelAnalysisResult`, and `RequiredFactCoverage` are typed contracts in `types.ts`. The generation options are view settings, not another announcement source.

## Coverage and status

| Coverage state | Meaning                                                                                |
| -------------- | -------------------------------------------------------------------------------------- |
| Included       | The complete current source fact has a valid semantic reference in the actual payload. |
| Source missing | The structured field is blank or a recognized placeholder.                             |
| Source invalid | The source date or contact fails the supported syntax check.                           |
| Omitted        | A valid source fact has no complete valid reference in the actual payload.             |

Required fields use the existing scenario schema. Source errors/warnings remain separate from channel errors/warnings. Missing and omitted essential facts produce channel errors. Formatting cannot repair missing source information; placeholders never earn coverage. Stale, forged, changed, and clipped spans fail.

No aggregate score is shown. Even if channel checks pass, unresolved source errors yield `needs-attention` overall; source warnings retain `review-needed`. **Passing checks is not a safety certification, human approval, or proof of factual correctness.** Included facts may still be false or unclear.

Additional free-text context is excluded from all channel templates and disclosed by informational finding `CH-<CHANNEL>-004`. A source warning calls for human review of that context. Essential details belong in structured fields. Optional relevant structured details, including route access, workarounds, reasons, and end estimates, are retained when supplied.

## SMS

The alphabet and extension characters follow [ETSI / 3GPP TS 23.038](https://www.etsi.org/deliver/etsi_ts/123000_123099/123038/18.00.00_60/ts_123038v180000p.pdf). Basic GSM characters use one septet; extension characters `^ { } \\ [ ] ~ | €` and form feed consume two. Raw ESC is a reserved introducer and is not treated as a printable basic character.

One non-GSM character switches the full message to a Unicode estimate using UTF-16 code units. Supplementary emoji require two units per code point; joined emoji can contain several code points. Code-point counts and encoding units are labeled separately.

Standard budgets: **160 septets** for one GSM-7 segment, **153** per multipart segment; Unicode **70 code units** for one segment, **67** per multipart segment. The [provider reference documents these budgets and exceptions](https://www.twilio.com/docs/glossary/what-sms-character-limit). This implementation keeps escape/surrogate pairs together at boundaries, which can leave unused units and raise the estimate above a simple ceiling calculation. Empty text has zero segments.

Segments are **estimated standard-based segments**, not guaranteed provider behavior. National language shift tables, smart encoding/transliteration, alternative headers, and provider limits are not modeled. No characters are silently substituted. Above **six segments** is a product review threshold, not a carrier limit. Multipart content is retained and shown as a reassembled message.

**Stress test: first segment only** intentionally keeps only the first transport segment of multipart text. It is artificial loss, not normal SMS delivery. Coverage reports every partially clipped or omitted essential fact as an error. Disable the test to restore the full payload. Metrics always describe the current exportable text; encoding can change if a non-GSM character falls outside the retained segment.

## Push

The compact card uses a **32-code-point title / 110-code-point body** budget; roomy uses **48/190**, including the displayed ellipsis. The first part of a fact is not counted as fully visible. A fact can be included in the full payload and **Visible**, **Partial**, or **Hidden** in the collapsed card. Expanding shows the full text without changing the collapsed visibility analysis.

The body can lead with the required action or scenario details to demonstrate why order matters. Presets are generic approximations, not exact OS limits, real-device render measurements, or accessibility validation. Font, language, screen size, device/OS settings, and assistive technology can change actual visibility.

## Email

The subject is generated from the source title. The body leads with required action, followed by scenario details, effective/scheduled time, supplied time zone/offset, audience, relevant optional facts, and contact/update route.

The simulated inbox clips a generic subject sample to **60 code points** and a body snippet to **120**. Full subject/body are retained. Real clients can select different snippets. Desktop/mobile width controls change the preview layout; neither certifies an email client. Sender identity is explicitly unconfigured, and no delivery/read status or institutional authority is asserted.

## Rules, exports, and persistence

- `CH-*-001-<field>`: required fact availability and actual payload coverage.
- `CH-*-002`: visible missing/invalid markers and TBD/TBC placeholders.
- `CH-*-003`: channel content, email subject, and push title availability.
- `CH-*-004`: excluded supplementary context disclosure.
- `CH-SMS-005`–`008`: multipart, excessive length review threshold, Unicode estimate, artificial cutoff.
- `CH-PUSH-005` and `006-<field>`: generic clipping and each represented fact's collapsed visibility.
- `CH-EMAIL-005`–`006`: approximate subject clipping and inbox snippet explanation.

Findings contain ID, severity, status, affected channel, explanation, suggested correction, and source field when relevant. Informational findings are shown separately from error/warning counts. Passed checks remain inspectable.

Copy/export uses the exact current payload; push copy includes the full title/body rather than only the collapsed sample. Email subject/body can be copied separately. Exports can contain missing markers or deliberately shortened stress-test text, with visible findings explaining those gaps. Export does not send or approve a message.

The application reads preserved v1 drafts/evidence and writes separate v2 keys. Working channel controls live in memory; snapshots retain exact channel settings, payloads, results, timezone interpretation and assumptions. Restoring copies those values and recomputes live results under current rules without altering historical evidence. See [review/evidence architecture](REVIEW-EVIDENCE.md).

Push visibility warnings group action/time/location concerns first, then expandable ordinary collapsed-card limitations. The summary states whether the full required action remains visible. Individual IDs, severities, counts, errors and the detailed fact matrix remain available.

The pinned Temporal polyfill provides date-aware IANA interpretation. Named-zone time references use the same resolved date/clock/zone/offset as source validation and final text; DST gaps and unresolved overlaps are source-invalid and never earn fact coverage. Each endpoint resolves separately, so intervals can cross offset changes. Source/channel rules are version 2.0 and templates 2.1; original recorded results retain their versions. See [time interpretation](REVIEW-EVIDENCE.md#time-interpretation).

The coverage matrix is a semantic table with caption and explicit row/column headers. `LOCAL LIVE` describes local recalculation, not delivery. Rendering and encoding budgets are simulations, not provider/device guarantees.
