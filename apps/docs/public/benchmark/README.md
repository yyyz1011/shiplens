# Synthetic workflow benchmark v1

This compares **a reusable Playwright script with ShipLens's review workflow**, not GPT alone against GPT + ShipLens. No model is invoked. Both arms use the same explicit requirements, selectors, expected text and deterministic evaluator. The package author wrote the fixtures and evaluator. These results cannot establish visual reasoning accuracy, model cost, human time saved or performance on customer projects.

## Protocol

- Three local fixture patterns: incorrect catalog price; failed registration confirmation after a click; mobile-only stale dashboard status. These are three synthetic pages, not three independent applications.
- Two Chromium viewports: 1440 × 900 and 390 × 844, scale 1, reduced motion, fresh isolated contexts. Mobile is emulation.
- Each paired cycle captures the broken fixture, then the repaired fixture. The dashboard desktop state is also a clean control before repair.
- Five repetitions per pattern and arm; alternate which arm runs first. This yields 15 paired cycles, 60 observations per arm: 25 defective and 35 clean. Repetitions reuse the same three defects; they are not 25 unique bugs. No warm-up exclusion or selective reruns in the formal batch.
- Both arms wait for DOMContentLoaded, then the explicit click when required. Fixtures are synchronous and have no external resources, authentication, server writes or network latency. ShipLens settle is 0, scroll and crawl disabled. Both capture the same result region and visible text.
- Playwright saves PNGs, visible text, assertions and runtime/HTTP errors; replay uses the same reusable script with new browser state. ShipLens additionally captures page/flow smoke checks, bounded DOM, machine reports, assessment receipts and a saved case. It uses collect, readEvidence, assess, saveCase, recheck, compareRuns, exportReport and gate. These are different output scopes, not an equal-work engine microbenchmark.
- Cycle timing includes browser startup, both phases, evidence writes, exact-text judgments and (ShipLens) case saving. After-phase timing includes recheck and fresh judgments. It excludes installation, script authoring, diagnosis, code repair, model calls, the comparison HTML export, and integrity probes. Report generation has its own timer. No time/token/dollar savings claim is inferred.
- Each formal trial, failure, observation, checksum, timing, tool/runtime version and policy-probe outcome is retained in results.json. Failures are not silently removed from timing summaries. Local artifact bytes include extra ShipLens report and probe artifacts, so are not an equal-output storage comparison.

## Integrity probes

On each ShipLens cycle, test a fresh pending replay, old-run evidence citation, missing mobile evidence, deleted cited image and a valid fresh pass. Also deliberately submit an incorrect semantic pass on a broken page with complete current evidence: the gate is expected to accept that caller claim because it validates workflow/evidence, not business meaning. Restore the honest assessment afterward. The published HTML is generated from honest assessments before these probes.

The baseline script produces fresh assertions on every replay. It has no custom citation registry or acceptance gate. Those capabilities can be built around Playwright; they are supplied here by ShipLens. We do not count “baseline has no such API” as a detected defect or an AI hallucination.

## Reproduce

From the repository root, on Node 22.12+:

```sh
npm ci
npm run browsers
npm run benchmark:workflow
```

Output defaults to a new ignored artifacts/benchmark-TIMESTAMP directory. Set BENCH_OUTPUT to a fresh directory and BENCH_REPETITIONS to 1–20 if needed. A run that reuses an existing output directory is not a clean benchmark. Opening the generated results.json shows paths to every ShipLens comparison HTML report. All sites are served temporarily on loopback; the server closes afterward.

Two one-repetition development pilots preceded the formal batch. Pilot 1 exposed a harness path mistake in the deleted-image probe; pilot 2 verified that repair. Baseline navigation was then aligned from networkidle to DOMContentLoaded before the formal batch. Pilots are excluded from formal statistics and are downloadable separately. No ShipLens engine code was modified for this benchmark.

## What remains unmeasured

An independent model comparison requires isolated sessions, the same pinned model, prompts, permissions and budget; hidden ground truth and held-out projects; both arms allowed competent browser tooling; retained failures and model usage; and adjudication of unsupported claims and usable regressions. This benchmark does not run those sessions and does not claim to answer that question.
