# Release guide

GitHub and npm are separate systems. A push to GitHub does not update the npm package unless a release workflow publishes a new version.

## Current release channel

The package currently publishes under the `beta` dist-tag:

```bash
npm install webgraphiclibrary@beta
```

## Manual beta release

```bash
pnpm verify
pnpm version prerelease --preid beta
npm publish --tag beta
git push --follow-tags
```

## Automated beta release

The repository includes `.github/workflows/publish.yml` for npm Trusted Publishing.

Configure npmjs.com package settings:

- Publisher: GitHub Actions
- Owner/user: `ahmerhabib`
- Repository: `webgraphiclibrary`
- Workflow filename: `publish.yml`
- Allowed action: `npm publish`

Then release with:

```bash
pnpm verify
pnpm version prerelease --preid beta
git push --follow-tags
```

The tag push triggers the workflow and npm accepts the publish through OIDC. npm requires Node 22.14.0 or newer and npm CLI 11.5.1 or newer for Trusted Publishing.
