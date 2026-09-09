# Delivery contract case study

This is a bounded, reproducible correctness comparison using one maintainer-controlled application. It is not a customer study, an AI evaluation, or evidence of market preference.

The example writes JSON records to a file. Every trial supplies a fresh UUID through the form, allowing an independent API readback to distinguish that operation from old records. Five application modes cover a healthy control and four deliberately implemented defects: omitted write, duplicate write, success UI after an injected HTTP 503, and success UI without sending the mutation.

## Protocol

For each mode, run desktop and mobile once. Compare:

- UI-only Playwright: accepts the normal branch when the visible message is `Saved`.
- Complete Playwright: an independently written script checks zero matching records before the action, one matching mutation with a successful response, success text, one matching record with expected fields, and a fresh-context HTTP 503 branch with error text and no record.
- ShipLens: the packaged delivery contract implements the same intended conditions and saves layered results and screenshots.

The complete Playwright baseline uses APIRequestContext; ShipLens reads the API outside application JavaScript with Node fetch. Each implementation uses isolated trials and unique references. A failing normal ShipLens branch skips its failure trial rather than implying coverage. The summary counts viewport cases, not individual trial rows.

## Recorded result

Both complete Playwright and ShipLens accept the two healthy viewport cases and reject all eight defective viewport cases. The UI-only check accepts all eight defects. This shows what the complete contract catches beyond a success message; it does **not** show superior detection over equally complete Playwright tests.

Raw results, baseline observations, the contract, source hashes and a checksum manifest for 33 report/evidence files are committed under `apps/docs/public/delivery-proof/`. The runner hash is verified against the current runner; implementation hashes identify the historical recording, rather than silently rewriting it after unrelated changes.

## Reproduce

From the repository root, with the supported Node version:

```sh
npm ci
npm run browsers
npm run benchmark:delivery
```

The runner starts and closes local file-backed servers. Results go to `artifacts/delivery-proof-<timestamp>`. Set `SHIPLENS_RECORD_DELIVERY=1` to replace the published case study deliberately. `npm run benchmark:verify` verifies the committed recording and file checksums without running browsers.

## Scope

The intended advantage is a reusable configuration, one API/MCP operation, and related request/UI/readback evidence. This study does not measure setup time, tokens, AI reasoning, human effort, performance, false positives on real projects, or customer outcomes. The application requires an editable correlation field and a suitable readback API. Readback establishes the API projection during a bounded interval, not database durability, permission correctness, payment settlement, or later background activity. Successful trials create test records, and neither cancellation nor ShipLens cleans them up automatically.

Playwright already supports [API postcondition checks](https://playwright.dev/docs/api-testing) and [network mocking](https://playwright.dev/docs/mock).
