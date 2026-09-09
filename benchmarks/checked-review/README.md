# Checked review protocol benchmark

This is an author-run **synthetic protocol benchmark**, not an AI accuracy or token evaluation. The fixture is a six-section checkout with five explicitly automated text requirements and one deliberately unasserted text requirement. The last requirement is left manual to demonstrate a mixed workflow; it is still judged by a scripted text oracle, not a real human or model. Both arms receive the same requirements, exact selectors and expected answers.

Three arms run sequentially in rotating order: a reusable Playwright script; the published npm `shiplens@0.4.1` review workflow; and the local 0.5.0 candidate with five check-only criteria plus a packet for attention items. Every phase uses a fresh Chromium browser and isolated desktop/mobile contexts (1440×900, 390×844, scale 1), DOMContentLoaded, synchronous local content, no external resources, settle/scroll/crawl disabled. Five repeats include a broken price ($29 instead of $19) before repair and six clean criteria afterward. There are 120 observations per arm, 10 repeated defective observations and 110 clean controls, not ten unique bugs.

The 0.4.1 flow reads each evidence item and submits one scripted caller judgment per criterion. The 0.5.0 flow runs configured text assertions and reads unresolved evidence in bounded packets; the unasserted item still receives a caller judgment. SDK operation counts also correspond to available MCP tool operations. **They are not model turns, token use, a minimum number of calls, or a comparison against a custom batched wrapper.** Playwright already supports deterministic reusable assertions; it has no ShipLens review-API operation count. No AI provider is invoked in any arm.

Cycle timing includes browser launches, two evidence collections, disk writes, configured/scripted evaluations, ShipLens case saving and final gate. Package installation, source authoring, diagnosis, code repair, exports and false-pass probes are excluded. ShipLens produces extra machine reports and an acceptance ledger, so timing is not an equal-output engine comparison. No warmup results are discarded. One development pilot preceded the formal batch; its timings are not included. Before the formal batch, observation accounting was corrected to read actual recorded/automatic statuses rather than reapplying the oracle to exported text.

After each measured ShipLens cycle, deliberately submit a false price pass using complete before-run evidence. A 0.4.1 caller can overwrite its recorded judgment; 0.5.0 refuses to overwrite a check-only criterion. This does not mean it can validate arbitrary AI reasoning: wrong/missing expectations and unasserted criteria still need independent review. Unit tests separately exercise manual criteria with text guardrails, missing/truncated evidence, case import/replay, changed-scope comparability and byte-limited packet omissions.

## Reproduce

Use Node 22.12+ on macOS/Linux. The benchmark was measured on macOS/Apple M4; it has not been benchmarked on Windows.

```sh
git clone https://github.com/yyyz1011/shiplens.git
cd shiplens
git checkout v0.5.0
npm ci
npm run browsers
npm run benchmark:checked
```

The runner installs the pinned 0.4.1 npm baseline with lifecycle scripts disabled into a fresh ignored artifact directory. npm install requires network access but is outside the timers. Existing output directories are rejected. BENCH_REPETITIONS accepts 1–20; default is 5. The raw JSON records every trial, failure, individual phase time, per-method operation count, caller-receipt count, actual recorded status, separate expected-text oracle, screenshot SHA-256 and false-pass outcome. The JSON metadata records the script checksum and engine base commit; the v0.5.0 release provides the candidate changes.

This measures one controlled mixed workflow. It establishes neither reduced production incidents nor reduced human time, increased model accuracy, paying demand, or an overall advantage over Playwright. To test those claims requires independent model sessions and real held-out projects.
