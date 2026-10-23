# Screenshots

Application screenshots captured on 23 October 2026 from a production build mounted at `/SignalProof/`. Four desktop images are **1600 × 900 (16:9)**; two mobile examples are **390 × 844 CSS px**, at device scale 1.

| Asset | Description |
| --- | --- |
| [01 — Announcement Lab](01-announcement-lab-desktop.png) | Missing action, effective time and alternative entrance produce three errors, plus two recommendations. |
| [02 — Push simulation](02-push-simulation-desktop.png) | A complete source can still hide essential facts in a collapsed push card. Full inclusion and visibility are separate. |
| [03 — Version comparison](03-version-comparison-desktop.png) | Two real-engine demo snapshots show three source errors resolved. Neither version is human reviewed. |
| [04 — Evidence report](04-evidence-report-desktop.png) | Exportable evidence records exact results and assumptions, with an explicit simulation boundary. |
| [05 — Mobile push](05-push-simulation-mobile.png) | The generic collapsed card on a narrow viewport; this is not a claim of physical-phone testing. |
| [06 — Mobile report](06-evidence-report-mobile.png) | The same illustrative report in a narrow layout. |

The captures use built-in fictional examples and reserved `.example` contact domains in an isolated Edge context. No reviewer records are present. IDs, timestamps and results come from the running application.

To regenerate on a machine with Microsoft Edge installed:

```sh
npm ci
npm run assets:release
```

The command uses port 4177 and replaces the six named screenshots. Evidence exports and browser profiles remain in ignored directories.
