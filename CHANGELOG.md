# Changelog

## 0.8.0

- Add reusable delivery contracts connecting one authorized browser mutation to a generated correlation marker, independent JSON API readback and an exercised HTTP 503 failure trial. Require an absent precondition, one matching saved record, explicit UI feedback and no false success during failure.
- Expose verifyDelivery/getDelivery/readDeliveryEvidence through TypeScript, CLI and MCP, with per-layer results and a standalone HTML report. Incomplete and skipped trials cannot pass. Results are bounded snapshots; successful trials can create real test records and do not perform cleanup.
- Include a file-backed application example and an independently scripted Playwright comparison covering four deliberate defects, healthy controls and both viewports. Publish bilingual contract documentation and original evidence.

## 0.7.0

- Challenge passing text checks with offline counterexamples from saved evidence through `auditChecks`, `review audit`, and `shiplens_audit_checks`. Report concrete surviving numeric/text variants, custom unacceptable states, baseline eligibility, per-device proof identifiers, pagination and byte limits. Audits are advisory and never modify acceptance or evidence.
- Include a runnable packaged example and a reproducible three-fixture comparison corroborated against actual browser states and independent Playwright predicates. No AI accuracy, customer benefit or competitive speed claims.
- Document all parameters, result semantics, limitations and the measured comparison in English and Chinese.

## 0.4.0

A complete local acceptance workflow, compatible with the existing CLI, root API and core review methods.

- Capture unique visible components with masked PNG and scoped DOM evidence, including intermediate interaction states.
- Compare requirements across runs with paired device evidence, text/image change signals and guarded resolved/regressed transitions. Recheck against an explicit later run from the same case.
- Discover runs and cases; search, tag and rename case metadata; export/import versioned portable plans with relative routes and named inputs.
- Export immutable acceptance snapshots as HTML (with before/after images), JSON or Markdown. Gate recorded assessments, evidence availability, machine findings and coverage for CI.
- Add progress, cancellation and total review deadlines, root scan AbortSignal support, failure categories and local doctor diagnostics.
- Expand to 17 MCP tools, add JSON-oriented review CLI commands and a packaged end-to-end workflow example.
- Document every new API/tool/command in English and Chinese, with boundary and migration guidance. Model judgments and efficiency gains are not independently certified by the package tests.

## 0.1.0

Initial public release: nine browser checks, explicit/hash routes, imported Playwright sessions, readiness selectors, exact data-request allowlists, bounded scrolling, screenshots, privacy masks and coverage-aware baseline reports. Includes an ESM/TypeScript API and English/Chinese documentation with light/dark themes.

Subsequent patch releases are recorded in GitHub Releases. Their tags identify the exact source commit and attached npm tarball.
