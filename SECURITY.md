# Security

webgraphiclibrary is a local rendering utility package. It does not make network requests, store credentials, or process server-side user input.

## Reporting

Please report vulnerabilities privately through GitHub's
[private vulnerability reporting](https://github.com/ahmerhabib/webgraphiclibrary/security/advisories/new)
(Security → Advisories → Report a vulnerability). Include a minimal
reproduction and the affected package version.

If private reporting is unavailable, open a GitHub issue that describes the
impact without publishing a working exploit, and we will coordinate a fix.

## Supply chain

- Dependencies are updated through Dependabot (`npm` and `github-actions`).
- CI runs `pnpm audit --prod` on every push and pull request.
- Releases publish with npm provenance via GitHub Actions Trusted Publishing.
- `pnpm verify` (lint, type-check, test, build, packaged-export check) runs
  before publishing, and `npm pack --dry-run` inspects the published files.
