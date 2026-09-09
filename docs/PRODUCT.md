# Product scope

ShipLens is a local Chromium smoke checker for website delivery. Its output is evidence, not an AI-generated approval or universal quality score.

Primary workflow: start a website, choose pages and readiness/authentication conditions, scan desktop and mobile, review HTML or hand Markdown to a coding assistant, fix confirmed issues, then compare the same scope.

The first release covers nine browser rules, explicit/hash routes, test authentication state, bounded scrolling, element evidence, masking, precise data request allowlists, rule exclusions, reporting and cautious baseline comparison. It does not implement interactive business workflows, autonomous repairs, full accessibility/security audits, or production acceptance.

Documentation ships in English and Chinese, with explicit light/dark preferences and English as the initial language. Core usage requires no account or AI provider configuration.
