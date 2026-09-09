# Architecture

- `packages/cli/src/options.js`: option validation, URL scope, request policy, redaction, issue fingerprints and baseline comparison.
- `scan.js`: isolated Playwright contexts per page/viewport, bounded queue and scroll observation, readiness tracking and evidence capture.
- `interactions.js`: bounded caller-defined actions; `suppressions.js`: precise matching, expiry and retained suppressed evidence.
- `rules.js`: deterministic DOM measurements and bilingual rule labels.
- `report.js`: escaped HTML and Markdown generation plus structured JSON; report schema 2.
- `cli.js`: commands/configuration and exit thresholds. `index.js` and `index.d.ts` expose the ESM/TypeScript API.
- `apps/docs`: Vite static site with hash navigation, local fonts, EN/ZH content and stored theme/language preferences. Build base and displayed release version are configurable for Pages.
- `scripts/prepare-release.mjs`: registry-driven, commit-aware patch version preparation. GitHub Actions gates npm and Pages on test results.

Each scan creates a restricted run directory and separate contexts; authentication state is loaded from a caller-supplied file and excluded from saved reports. HTML escapes tested content and constrains screenshot links. Screenshots may still contain sensitive page content, and arbitrary text is not fully sanitized.

Coverage state is part of the report, not inferred from the absence of findings. Options, target identity, authentication fingerprint, actual page/viewport coverage, final URLs and completion must match before absent findings can be called resolved. Limited scrolling or truncated crawling disables this interpretation.

Flow checks use separate contexts and step-specific screenshots. Flow configuration is fingerprinted without persisting input values. Precise ignore entries filter findings only after evidence capture, preserve matched findings in `suppressed`, and include active/expired state in coverage comparability.
