# Security

webgraphiclibrary is a local rendering utility package. It does not make network requests, store credentials, or process server-side user input.

## Reporting

Please report vulnerabilities privately through GitHub's
[private vulnerability reporting](https://github.com/ahmerhabib/webgraphiclibrary/security/advisories/new)
(Security → Advisories → Report a vulnerability). Include a minimal
reproduction and the affected package version.

If private reporting is unavailable, open a GitHub issue that describes the
impact without publishing a working exploit, and we will coordinate a fix.

## Supply chain and hardening

- **Zero runtime dependencies** — no third-party code ships to consumers, and
  the package makes no network requests and collects no telemetry.
- **Pinned CI** — every GitHub Actions step is pinned to a full commit SHA;
  Dependabot keeps the pins (and `npm` dev-dependencies) current.
- **Automated scanning** — CodeQL code scanning and OpenSSF Scorecard run on
  `main` and on a weekly schedule; CI runs `pnpm audit` on every push and PR.
- **Signed releases** — published with npm provenance via GitHub Actions
  Trusted Publishing (OIDC). `pnpm verify` (format, lint, type-check, test with
  coverage, build, packaged-export check) runs before publishing, and
  `npm pack --dry-run` inspects the published files.
