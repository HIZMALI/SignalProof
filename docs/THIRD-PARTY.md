# Attribution and dependency licenses

No license for SignalProof's original source or screenshots has been selected. The licenses below apply to third-party components only.

## Shipped code and styles

| Package | Locked version | Package terms |
| --- | --- | --- |
| React / React DOM | 19.3.1 | MIT |
| Scheduler | 0.28.0 | MIT |
| Lucide React | 1.61.0 | ISC, including the upstream icon notices in the distributed license text |
| Temporal polyfill | 0.5.1 | ISC |
| JSBI | 4.3.2 | Apache-2.0 |
| Tailwind CSS | 4.3.3 | MIT; generated CSS |
| Vite | 8.3.5 | MIT and bundled notices; generated loading helpers |
| Rolldown | 1.2.15 | MIT; generated bundle helpers |

Full installed license texts are copied into [`public/third-party-notices.txt`](../public/third-party-notices.txt), which Vite includes as `dist/third-party-notices.txt` for distribution with the app. These are upstream notices, not a grant of rights to SignalProof. Package links in that text identify the exact versions. The Lucide file preserves its Feather-derived upstream terms as supplied; its package-level ISC label is not a substitute for those notices.

## Build and test dependencies

The [complete lockfile inventory](DEPENDENCY-LICENSES.md) lists **202 package entries**, including optional operating-system packages and peer/type dependencies. Every entry has a declared license. The lockfile is the source of truth for versions and integrity; installed package license files remain authoritative for terms. Development dependencies such as TypeScript, Vitest, Testing Library, Playwright and axe are used for building/testing, not runtime services. Some build/test packages have compound or additional licensing terms; retain their installed notices if redistributing those tools. `node_modules/` and browser engines are not included in the repository or Pages artifact.

Run `npm run notices:generate` after `npm ci` when dependencies change. Review the generated diff; CI checks it for staleness. Do not assume newly added assets or packages are automatically covered by the existing list of shipped-code notices.

## Product assets and examples

The signal mark is implemented in project CSS and SVG, and the interface uses Lucide icons. Fonts use the system stack; no external web font, stock photography or image service is loaded. Release screenshots are real isolated-browser captures of the application, with fictional campus/event/service data and reserved `.example` contact domains. Old migration/test fixtures are synthetic and are not exported personal browser history. See [capture provenance](release-assets/README.md).

The SMS implementation references published 3GPP/ETSI encoding definitions and documented common segment budgets; references and limitations are in [CHANNELS.md](CHANNELS.md). No delivery provider is integrated. GitHub Actions are official GitHub-maintained actions, used through pinned references; their code is not vendored into the application.
