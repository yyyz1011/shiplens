# Release operations

The public repository is `yyyz1011/shiplens`, the default branch is `master`, the package is `shiplens`, and documentation is hosted on GitHub Pages at `https://shiplens.nimokit.com/`.

## Pipeline

`.github/workflows/release.yml` runs for pull requests, master pushes and manual dispatches.

1. Browser tests run on Linux/Node 22, Windows/Node 24 and macOS/Node 24.
2. Linux quality checks verify formatting, TypeScript declarations, independent tarball installation, documentation build and 152 language/theme/viewport/route cases plus interactions.
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

## Custom documentation domain

The documentation hostname is `shiplens.nimokit.com`. GitHub Pages remains the host and uses the Actions build source. Set the repository Pages custom domain to this hostname before adding DNS. In Tencent Cloud DNSPod, create only the `shiplens` CNAME record pointing to `yyyz1011.github.io` (without a repository path). Keep unrelated domain records intact.

Production and quality builds use `DOCS_BASE=./` so generated asset and example links work from both the repository URL and the custom-domain root. No CNAME file is needed for an Actions deployment; the repository Pages setting owns the domain binding. After DNS becomes visible, wait for GitHub's certificate issuance and ensure HTTPS enforcement is enabled. Verify the custom hostname, a documentation route, static report/image assets, and the old GitHub Pages redirect before considering migration complete.
