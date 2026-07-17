# Changelog

All notable changes to this package are documented here.

## 2.0.0-beta.2 — 2026-07-17

### Added

- TSDoc on every public export (types, classes, properties, and methods), including per-option-property notes and `@throws` annotations. The comments ship in the generated `.d.ts` bundles, so editors and type-aware tooling surface them on hover and completion.
- `llms.txt` manifest and `docs/recipes.md` / `docs/testing.md` guides to make the API easy to retrieve and apply.

### Changed

- Releases now publish through a tag-triggered GitHub Actions workflow using npm provenance, so each published version carries a verifiable build attestation.

### Security

- Added CodeQL and OpenSSF Scorecard workflows, SHA-pinned all GitHub Actions, and grouped Dependabot updates. The package continues to ship with zero runtime dependencies and performs no network or telemetry calls.

## 2.0.0-beta.1

### Added

- Scoped binding helpers: `GLBuffer.withBound`, `Texture2D.withBound`, and `Program.withUsed`.
- `Program` uniform ergonomics: cached `tryGetUniformLocation`, typed `setUniform*` setters, `setTexture`, and the `enableAttribute` vertex-layout helper (with WebGL2 instancing `divisor`).
- `GLBuffer.updateSubData` for partial buffer updates.
- `Texture2D` image/canvas/video uploads (`uploadImage` and the `image` option), `flipY` / `premultiplyAlpha` options, and `generateMipmap`.
- Allocation-free readback: `Framebuffer.readPixelsInto` and `readTexturePixelsInto`.
- `Framebuffer.invalidate` (WebGL2) and automatic float/half-float color-buffer extension enabling.
- WebGL2 `MultiTarget` (multiple render targets) and `MultisampleTarget` (multisample render + blit resolve).
- Shared `withSavedBindings` primitive exported from `core`.
- Real-browser render tests (`pnpm check:browser`), a packaged-export/tarball check (`pnpm check:package`), and additional examples (minimal-triangle, pipeline, picking, self-test).
- Documentation: rewritten README plus per-module reference pages, a support matrix, and a comparison page.

### Fixed

- Enabled bundler code splitting so shared classes (for example `WebGLError`) keep a single identity across subpath exports, fixing `instanceof` checks between `webgraphiclibrary/core` and other entry points.

### Changed

- Context validation now applies to `Shader`, `Program`, `GLBuffer`, and `Texture2D` (previously only `Framebuffer`).
- Shader compile errors are annotated with the shader stage and numbered source; program link errors are clearly prefixed.
- `pnpm verify` runs the real gate (format, lint, typecheck, test, build, packaged-export check) instead of nesting it inside the screenshot script; CI runs each step explicitly with a separate browser-test job and `pnpm audit`.
- Trimmed the published tarball to `dist` plus documentation text (~40 kB).

## 2.0.0-beta.1

- Rebuilt the package around explicit TypeScript subpath exports.
- Added the first v2 resource wrapper: `Framebuffer`.
- Added `Shader`, `Program`, `GLBuffer`, `Texture2D`, and texture readback helpers.
- Added framebuffer lifecycle helpers for bind, scoped bind, resize, canvas resize, readback, and disposal.
- Added WebGL state restoration for framebuffer, buffer, and texture resource operations.
- Added WebGL resource validation and framebuffer completeness errors.
- Hardened README screenshot static serving against path traversal.
- Added README screenshots generated from the project verification and browser demo workflow.
- Added a browser FBO post-process example.
- Prepared GitHub Actions for CI and npm Trusted Publishing.
