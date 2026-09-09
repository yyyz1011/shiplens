# Release operations

The public repository is `yyyz1011/shiplens`, the default branch is `master`, the package is `shiplens`, and documentation is hosted on GitHub Pages at `https://yyyz1011.github.io/shiplens/`.

## Pipeline

`.github/workflows/release.yml` runs for pull requests, master pushes and manual dispatches.

1. Browser tests run on Linux/Node 22, Windows/Node 24 and macOS/Node 24.
2. Linux quality checks verify formatting, TypeScript declarations, independent tarball installation, documentation build and 72 language/theme/viewport/route cases plus interactions.
3. On master, `NPM_TRUSTED_PUBLISHING=true` enables npm publication through GitHub OIDC, without a stored npm token.
4. `scripts/prepare-release.mjs` checks the registry. A new commit gets the next patch version, or a higher explicitly configured stable version. A published `gitHead` reuses its version on retry. Registry/network failures stop publication.
5. The exact tarball is published with provenance and attached to a GitHub release targeting the source commit.
6. Documentation deploys with that release version. Failed publication prevents documentation from advancing; during initial bootstrap, skipped npm publication still allows Pages deployment.

Release generation changes package metadata only inside the runner. The source package version is a release floor; the registry and GitHub release are authoritative. This avoids version-bump commits retriggering releases. Increase `packages/cli/package.json` for a deliberate minor or major release. Do not overwrite existing npm versions.

## Initial bootstrap

The first npm version must exist before configuring its trusted publisher. Publish the checked initial tarball using the maintainer's npm session, then configure:

- Provider: GitHub Actions
- Repository: `yyyz1011/shiplens`
- Workflow: `release.yml`
- Permission: publish
- No environment restriction (the publish job does not use an environment)

Use `npm trust github shiplens --repo yyyz1011/shiplens --file release.yml --allow-publish --yes` with npm 11.15+ or the package settings UI. npm may require the maintainer's browser/2FA verification. Only enable repository variable `NPM_TRUSTED_PUBLISHING=true` after configuration succeeds. GitHub Pages must use the Actions build source.

## Verification and recovery

Inspect the Actions result, the registry version and `gitHead`, the GitHub release, the provenance attestation, and the live Pages assets. An npm upload is not proof of Pages deployment. If a run fails after publication, rerun it: the commit check prevents a duplicate version and allows the release/Pages steps to finish.

Keep release changes scoped to this repository. Authentication files, npm configuration, generated private reports and local artifacts must not be committed. No account credentials belong in repository secrets for OIDC publishing.
