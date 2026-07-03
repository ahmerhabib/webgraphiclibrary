# Security

webgraphiclibrary is a local rendering utility package. It does not make network requests, store credentials, or process server-side user input.

## Reporting

Please report security issues through GitHub Issues with a minimal reproduction and the affected package version.

## Supply chain

Release builds should use:

- `pnpm verify` before publishing
- npm Trusted Publishing through GitHub Actions for automated releases
- version tags for registry publishes
- `npm pack --dry-run` to inspect published files before manual release
