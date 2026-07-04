# Examples

Each example is a self-contained HTML page that imports the built package from
`../../dist`. Run `pnpm build` first, then open a page through a local static
server (for example `pnpm dlx serve` from the repository root, or the server in
`scripts/check-browser.mjs`).

| Example                                | Modules exercised                                       |
| -------------------------------------- | ------------------------------------------------------- |
| [minimal-triangle](./minimal-triangle) | Shader, Program (uniform + attribute helpers), GLBuffer |
| [pipeline](./pipeline)                 | Shader, Program, GLBuffer, Texture2D, Framebuffer       |
| [fbo-postprocess](./fbo-postprocess)   | Framebuffer (off-screen post-processing)                |
| [picking](./picking)                   | Framebuffer id readback, Program, GLBuffer              |
| [self-test](./self-test)               | Real-WebGL assertion harness for `check:browser`        |

`pnpm check:browser` loads the self-test harness against a real WebGL context
(pixel readback, texture uploads, error paths) and smoke-tests every example
for load errors.
