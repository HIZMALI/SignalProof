# Testing and coverage

Verified on 23 October 2026. Local checks used Node 24 on Windows; the GitHub Pages workflow uses Node 22 on Linux.

| Check | Result | Coverage |
| --- | --- | --- |
| `npm test` | 234 passed across 15 files | Source rules, channel generation and coverage, time interpretation, storage, migration, evidence and UI workflows. |
| `npm run typecheck` | Passed | Strict TypeScript checks for application and browser tests. |
| `npm run build` | Passed | Production static bundle. |
| `npm audit` | 0 reported vulnerabilities | Locked dependencies at verification time. |
| `npm run test:e2e` | 25 passed, 2 skipped | Edge, Firefox and WebKit workflows; the skips are Chromium-only PDF generation. |
| `npm run test:pages` | 6 passed | Two production subpath smoke cases per engine. |
| `npm run test:live` | 9 passed | Three cases per engine against the actual public HTTPS site. |
| `npm run verify:release-build` | Passed | Two Pages builds produce identical files and SHA-256 hashes. |
| `node scripts/third-party-notices.mjs --check` | Passed | Shipped notices and dependency inventory match the lockfile. |

The Pages workflow installs Chromium and runs the two focused subpath smoke cases, alongside unit tests, type checking, dependency auditing, notice checks and build reproducibility. It deploys only `dist/`.

Browser coverage includes direct hash navigation, reload and Back/Forward; incomplete and corrected announcements; SMS estimates, push visibility and email payloads; downloads and clipboard controls; snapshot comparisons; content-bound human review; validated backup/restore; time zone gaps and repeated times; browser-local isolation; and narrow viewport layouts.

The browser suites use fictional data in isolated contexts. Completed review records in tests exercise form requirements and do not represent independent human verification. Routine screenshots, reports, profiles and generated PDFs stay in ignored test directories.

## Limits

Playwright WebKit is engine coverage, not Safari on Apple hardware. Mobile widths are emulation, not physical-phone tests. Automated axe and keyboard checks cover tested states; manual screen-reader testing, native browser zoom, OS text scaling, native print dialogs and physical devices remain unverified. Chromium PDF output and Firefox/WebKit print media are tested separately. No accessibility certification or real delivery guarantee is claimed.

See the [README](../README.md#automated-testing) for browser installation and test commands.
