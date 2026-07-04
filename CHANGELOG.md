# Changelog

All notable changes to this package are documented here.

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
