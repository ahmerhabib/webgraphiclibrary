# Getting started

webgraphiclibrary is a set of typed wrappers around individual WebGL resources. Each wrapper owns one resource's lifecycle — create, configure, bind, use, restore, dispose — and keeps the raw `WebGL*` handle available.

## Install

```bash
npm install webgraphiclibrary
# or
pnpm add webgraphiclibrary
```

The package is ESM only and has no runtime dependencies. You provide the `WebGLRenderingContext` or `WebGL2RenderingContext`.

## Core concepts

- **You own the render loop.** The wrappers never call `drawArrays` for you. They remove resource boilerplate; the draw calls stay yours.
- **Raw handles are always available.** `framebuffer.texture`, `program.program`, `buffer.buffer`, `shader.shader`, `texture.texture`.
- **State is restored.** Any helper that must bind a resource captures the previously bound resource and restores it in a `finally` (via `withSavedBindings` in `core`). Your renderer's bindings are never silently clobbered.
- **Failures are typed and early.** Invalid contexts, bad dimensions, failed allocation, incomplete framebuffers, and use-after-dispose all throw — `WebGLError` or `DisposedResourceError`.
- **Disposal is idempotent.** Calling `dispose()` twice is safe; using a resource after disposal throws `DisposedResourceError`.

## Subpath exports

Every module is importable from the root or a per-resource subpath. Subpaths keep bundles minimal.

| Import                      | Reference                           |
| --------------------------- | ----------------------------------- |
| `webgraphiclibrary/fbo`     | [Framebuffer](./framebuffer.md)     |
| `webgraphiclibrary/shader`  | [Shader](./shader.md)               |
| `webgraphiclibrary/program` | [Program](./program.md)             |
| `webgraphiclibrary/buffer`  | [GLBuffer](./buffer.md)             |
| `webgraphiclibrary/texture` | [Texture2D](./texture.md)           |
| `webgraphiclibrary/core`    | errors, guards, `withSavedBindings` |

## First render

```ts
import { Shader } from "webgraphiclibrary/shader";
import { Program } from "webgraphiclibrary/program";
import { GLBuffer } from "webgraphiclibrary/buffer";

const gl = canvas.getContext("webgl");
if (gl === null) throw new Error("WebGL is not available.");

const program = new Program(gl, {
  vertexShader: new Shader(gl, { type: gl.VERTEX_SHADER, source: vertexSource }),
  fragmentShader: new Shader(gl, { type: gl.FRAGMENT_SHADER, source: fragmentSource })
});

const triangle = new GLBuffer(gl, {
  target: gl.ARRAY_BUFFER,
  data: new Float32Array([0, 1, -1, -1, 1, -1])
});

program.withUsed(() => {
  program.enableAttribute("position", { buffer: triangle, size: 2 });
  gl.drawArrays(gl.TRIANGLES, 0, 3);
});
```

## Further reading

- [Recipes](./recipes.md) — copy-paste solutions to common tasks.
- [Advanced render targets](./advanced-targets.md) — WebGL2 multiple render targets and multisample resolve.
- [Support matrix](./support-matrix.md) — what each module supports on WebGL1 vs WebGL2.
- [Comparison](./comparison.md) — how webgraphiclibrary relates to twgl.js, regl, picogl.js, OGL, and luma.gl.
- [examples/](../examples) — runnable browser examples.
