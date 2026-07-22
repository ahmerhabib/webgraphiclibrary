# Release guide

GitHub and npm are separate systems. A push to GitHub does not update the npm package unless a release workflow publishes a new version.

## Current release channel

Releases publish under the `latest` dist-tag, so the npm package page and a plain install always reflect the newest version:

```bash
npm install webgraphiclibrary
```

## Automated release (the normal path)

The repository publishes through `.github/workflows/publish.yml` using npm Trusted Publishing (tokenless OIDC + provenance). One-time npmjs.com package settings:

- Publisher: GitHub Actions
- Owner/user: `ahmerhabib`
- Repository: `webgraphiclibrary`
- Workflow filename: `publish.yml`

To release:

1. Bump `version` in `package.json` and add a dated CHANGELOG section (on a branch → PR → merge).
2. Tag the merge commit and push the tag:

```bash
git tag -a vX.Y.Z -m "webgraphiclibrary X.Y.Z"
git push origin vX.Y.Z
```

The tag push triggers the workflow: `pnpm verify` gates the release, then npm accepts the publish through OIDC with a signed provenance statement. npm requires Node 22.14.0+ and npm CLI 11.5.1+ for Trusted Publishing.

## Manual fallback

```bash
pnpm verify
npm publish --tag latest
```

Requires `npm login`; loses provenance. Prefer the automated path.
