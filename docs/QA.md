# QA scope

Automated validation includes browser fixtures for seeded runtime/network/layout/image failures, clean pages, truncation, blocked writes, CLI exit codes/JSON, explicit/hash routes, imported authentication state, exact POST allowlists, delayed readiness, invisible blank content, lazy images, nested scrollers, coverage-aware baselines and screenshot mask validation. Release version selection and HTML injection/path defenses have regression tests.

`npm run test:pack` installs the actual tarball into an independent temporary consumer, verifies the CLI version, scans a real local fixture and imports the ESM API. TypeScript consumer declarations are checked separately.

`npm run test:ui` covers 9 routes × 2 languages × 2 themes × 2 viewports (72 combinations), persisted preferences, overflow, untranslated English UI, runtime/network errors, report interactions, search, copy, keyboard dismissal and mobile navigation. It also opens a fixture-generated report and checks filtering and screenshot loading. This is not a comprehensive accessibility audit or real-device test.

Local screenshots and machine results are under ignored `artifacts/`. Public `apps/docs/public/example/` contains only an intentionally seeded synthetic website and its generated report; it does not establish the quality of a real customer project.

GitHub Actions is the source of truth for platform-specific results and release status. Local checks alone do not establish that publication or deployment succeeded.
