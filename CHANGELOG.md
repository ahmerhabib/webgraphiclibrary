# Changelog

All notable changes to this package are documented here.

## 2.0.0 — 2026-07-23

First stable release of the v2 API. The API surface is now frozen under semantic
versioning: breaking changes will only ship in a 3.x release.

### Fixed

- `MultiTarget` and `MultisampleTarget` now enable `EXT_color_buffer_float` when
  a float or half-float color attachment is requested, matching what
  `Framebuffer` already did. Previously a float G-buffer or MSAA target was
  reported incomplete on real browsers.
- A failed `resize()` on `Framebuffer`, `MultiTarget`, or `MultisampleTarget`
  now reallocates the GPU storage at the previous dimensions instead of only
  reverting the reported `width`/`height`, so the wrapper and the underlying
  storage can no longer disagree after a failure.
- All framebuffer wrappers now save and restore the WebGL2
  `READ_FRAMEBUFFER` binding around bind/resize/scoped operations
  (`bindFramebuffer(FRAMEBUFFER, …)` sets both binding points, so the read
  binding was previously clobbered).
- `Program.setTexture` now rejects a disposed program before touching the
  active texture unit, matching every other method.
- `Texture2D.uploadImage` now throws a `RangeError` for sources with a zero
  dimension (for example an image or video that has not finished loading)
  instead of silently recording a `0×0` size.
- `UniformBuffer.update` and `UniformBuffer.bindRange` now validate offsets and
  sizes and throw a typed `RangeError` for negative, fractional, or
  out-of-bounds values instead of passing them through to the driver.

### Changed

- `GLBuffer` now validates its `target` at construction and supports binding
  restoration for all WebGL2 buffer targets (copy, pixel, transform-feedback,
  and uniform), not just `ARRAY_BUFFER`/`ELEMENT_ARRAY_BUFFER`. Unknown targets
  throw a `WebGLError` instead of silently clobbering bindings.
- `TextureUploadOptions` is narrowed to `{ width, height, data? }` — the only
  fields `upload()` ever honored. Formats, types, and filters are fixed at
  construction, and the type no longer suggests otherwise.
- Ordinary `Texture2D` operations (construction, `upload`, `generateMipmap`)
  no longer query and restore the framebuffer binding they never touched,
  removing a needless driver sync from hot paths.

## 2.0.0-beta.3 — 2026-07-22

### Added

- `VertexArray` (WebGL2 VAO) via the new `webgraphiclibrary/vao` subpath: record the vertex attribute layout — pointers, enable flags, instancing divisors, and the `ELEMENT_ARRAY_BUFFER` binding — once inside `withBound`, then restore it all with one bind at draw time.
- `UniformBuffer` (WebGL2 UBO) exported from `webgraphiclibrary/buffer`: `std140` uniform blocks shared across programs with `connect(program, blockName, index)`, `bindTo`/`bindRange`, and validated `update(data, byteOffset?)` partial writes.
- An [instancing example](examples/instancing) rendering 1,440 instances in one draw call through a `VertexArray` + `UniformBuffer`, with a real captured screenshot in the README, the examples gallery, and browser self-test coverage for both wrappers.
- A [WebGPU portability map](docs/comparison.md#webgpu-portability) documenting how each wrapper corresponds to a WebGPU concept.

### Changed

- Releases now publish under the `latest` dist-tag, so `npm install webgraphiclibrary` and the npm package page always reflect the newest version.
- The examples README is now a visual gallery with real captured output for each showcase example.

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
