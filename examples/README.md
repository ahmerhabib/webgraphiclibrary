# Examples

Each example is a self-contained HTML page that imports the built package from
`../../dist`. Run `pnpm build` first, then open a page through a local static
server (for example `pnpm dlx serve` from the repository root, or the server in
`scripts/check-browser.mjs`).

| Example                                | Shows                                                    |
| -------------------------------------- | -------------------------------------------------------- |
| [minimal-triangle](./minimal-triangle) | Smallest end-to-end render — Shader, Program, GLBuffer   |
| [postprocessing](./postprocessing)     | Multi-framebuffer bloom (bright-pass → blur → composite) |
| [gbuffer](./gbuffer)                   | `MultiTarget` G-buffer + deferred lighting (WebGL2)      |
| [antialiasing](./antialiasing)         | `MultisampleTarget` MSAA render + `resolve()` (WebGL2)   |
| [picking](./picking)                   | Color-id picking with `readPixelsInto`                   |
| [pipeline](./pipeline)                 | Texture2D → Framebuffer → screen pass                    |
| [fbo-postprocess](./fbo-postprocess)   | Framebuffer off-screen post-processing                   |
| [self-test](./self-test)               | Real-WebGL assertion harness for `check:browser`         |

`pnpm check:browser` loads the self-test harness against a real WebGL context
(pixel readback, texture uploads, error paths) and smoke-tests every example
for load errors. `pnpm screenshots` regenerates the README images from the
showcase examples via `scripts/capture-showcase.mjs`.
