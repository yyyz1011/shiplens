# Acceptance lock comparison

Run `npm ci`, `npm run browsers`, then `npm run benchmark:lock` from the repository root. Output goes to `artifacts/plan-lock-*`. To replace the published evidence deliberately, use `SHIPLENS_RECORD_PLAN_LOCK=1 node benchmarks/plan-lock/run.mjs`. `npm run benchmark:verify` validates published files against their SHA-256 checksums.

The fixture is one maintainer-controlled order-summary app. The native baseline runs the actual Playwright Test runner, desktop and mobile projects, and visible-text assertions. The approved criterion is exactly ¥129. Each of nine cases runs once:

- Three unchanged controls: healthy page, an unfixed wrong value, and editorial name/tag/requirement-order changes.
- Six standard changes: weakening equals to contains, rewriting the expected amount to the wrong value, removing the price requirement, redirecting the selector to a reference value, omitting mobile from the criterion, and narrowing the host to desktop.

The six modified native test commands succeed. An omitted mobile criterion is explicitly skipped; the narrowed host has no mobile project. Raw reporter JSON exposes these counts. ShipLens blocks all six before browser execution with zero HTTP requests. A separately coded custom guard comparing approved requirements, flows and viewport also blocks all six. This demonstrates a policy layer missing from the current-test-only workflow, not an intrinsic limitation of Playwright. Native tests with unchanged assertions correctly reject the wrong value.

The artifact manifest includes versions, runner and implementation fingerprints, native statistics, inspection results, gates and 27 artifact hashes. Native reporter paths are normalized before publishing. This experiment does not run an AI model, test hostile control of the host, measure customer setup time, or establish broad competitive superiority. It does not claim every possible weakening is covered. Lock definitions are exact comparisons, not semantic judgments. All definition/policy changes, including improvements, need reviewed replacement locks.
