# webgraphiclibrary

[![CI](https://github.com/ahmerhabib/webgraphiclibrary/actions/workflows/ci.yml/badge.svg)](https://github.com/ahmerhabib/webgraphiclibrary/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/webgraphiclibrary?tag=beta)](https://www.npmjs.com/package/webgraphiclibrary)
[![license](https://img.shields.io/npm/l/webgraphiclibrary)](LICENSE.md)

Small, type-safe WebGL utilities for developers building custom rendering pipelines.

webgraphiclibrary is not a scene graph, charting system, game engine, or Three.js replacement. It is a focused set of typed wrappers around WebGL resources that are repetitive to set up, easy to leak, and painful to debug when one line is wrong.

The current beta includes focused wrappers for framebuffers, shaders, programs, buffers, textures, and texture readback. Each module gives one WebGL resource a small lifecycle API while keeping raw handles available when your renderer needs direct control.

![Framebuffer workflow](docs/assets/fbo-workflow.png)

## Why Use It

Choose webgraphiclibrary when you want to stay close to WebGL but stop rewriting the same resource boilerplate.

| If you need...                                                                 | Use...                 |
| ------------------------------------------------------------------------------ | ---------------------- |
| A full 3D scene graph, loaders, cameras, controls, and materials               | Three.js or Babylon.js |
| A high-level 2D canvas object model                                            | Konva or Fabric.js     |
| A production whiteboard or infinite canvas SDK                                 | tldraw or Excalidraw   |
| Charts and data visualization                                                  | D3 or Chart.js         |
| Small WebGL resource wrappers for custom engines, effects, demos, and teaching | webgraphiclibrary      |

## Features

- Typed ESM package with explicit subpath exports.
- `Framebuffer` wrapper for color render targets backed by `WebGLTexture`.
- `Shader` and `Program` wrappers for compile/link workflows and lookup errors.
- `GLBuffer` wrapper for typed vertex/index buffer uploads.
- `Texture2D` wrapper for texture allocation, upload, and disposal.
- `readTexturePixels` helper for texture inspection through a temporary framebuffer.
- Optional framebuffer depth or depth-stencil renderbuffer storage.
- Early validation for dimensions, WebGL contexts, resource allocation, and framebuffer completeness.
- Explicit lifecycle methods: `bind`, `withBound`, `resize`, `resizeToCanvas`, `readPixels`, and `dispose`.
- Raw WebGL handles exposed for direct rendering pipeline integration.
- Idempotent disposal and typed WebGL errors.
- Browser demo and README screenshots generated from the real build workflow.

## Install

```bash
npm install webgraphiclibrary@beta
```

```bash
pnpm add webgraphiclibrary@beta
```

## Quick Start

```ts
import { Framebuffer } from "webgraphiclibrary/fbo";

const canvas = document.querySelector("canvas");
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error("Canvas element was not found.");
}

const gl = canvas.getContext("webgl");
if (gl === null) {
  throw new Error("WebGL is not available.");
}

const target = new Framebuffer(gl, {
  width: canvas.width,
  height: canvas.height,
  depth: true
});

target.withBound(() => {
  gl.viewport(0, 0, target.width, target.height);
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  // Draw the off-screen scene here.
});

gl.viewport(0, 0, canvas.width, canvas.height);
gl.bindTexture(gl.TEXTURE_2D, target.texture);

// Draw a fullscreen pass and sample target.texture in your fragment shader.

target.dispose();
```

## Common Workflows

### Post-Processing

Render a scene into a `Framebuffer`, then sample `framebuffer.texture` in a fullscreen pass for blur, color grading, distortion, scanlines, or custom compositing.

See [examples/fbo-postprocess](examples/fbo-postprocess).

![Rendered framebuffer post-process demo](docs/screenshots/fbo-postprocess-demo.png)

### Picking and Readback

Render object IDs or encoded values into an off-screen target, then call `readPixels()` to inspect the result.

```ts
const pixels = pickingTarget.readPixels();
const firstPixel = pixels.slice(0, 4);
```

### Responsive Render Targets

Keep off-screen targets aligned with a canvas backing store.

```ts
target.resizeToCanvas(canvas);
```

### Resource Wrappers

Compile shaders, link a program, upload vertex data, and allocate a texture without giving up direct WebGL access.

```ts
import { GLBuffer } from "webgraphiclibrary/buffer";
import { Program } from "webgraphiclibrary/program";
import { Shader } from "webgraphiclibrary/shader";
import { Texture2D } from "webgraphiclibrary/texture";

const vertexShader = new Shader(gl, {
  type: gl.VERTEX_SHADER,
  source: vertexSource
});

const fragmentShader = new Shader(gl, {
  type: gl.FRAGMENT_SHADER,
  source: fragmentSource
});

const program = new Program(gl, {
  vertexShader,
  fragmentShader
});

const vertices = new GLBuffer(gl, {
  target: gl.ARRAY_BUFFER,
  data: new Float32Array([-1, -1, 1, -1, -1, 1]),
  usage: gl.STATIC_DRAW
});

const texture = new Texture2D(gl, {
  width: 256,
  height: 256
});
```

## Imports

```ts
import { Framebuffer, FBO } from "webgraphiclibrary/fbo";
import { Shader } from "webgraphiclibrary/shader";
import { Program } from "webgraphiclibrary/program";
import { GLBuffer } from "webgraphiclibrary/buffer";
import { Texture2D, readTexturePixels } from "webgraphiclibrary/texture";
import { WebGLError, DisposedResourceError } from "webgraphiclibrary/core";
```

Current subpath exports:

- `webgraphiclibrary`
- `webgraphiclibrary/buffer`
- `webgraphiclibrary/core`
- `webgraphiclibrary/fbo`
- `webgraphiclibrary/program`
- `webgraphiclibrary/shader`
- `webgraphiclibrary/texture`

## Framebuffer API

### Constructor

```ts
const target = new Framebuffer(gl, {
  width: 1024,
  height: 1024,
  depth: true
});
```

| Option           | Type      | Default            | Notes                                              |
| ---------------- | --------- | ------------------ | -------------------------------------------------- |
| `width`          | `number`  | required           | Positive integer width in pixels                   |
| `height`         | `number`  | required           | Positive integer height in pixels                  |
| `internalFormat` | `number`  | `gl.RGBA`          | Texture internal format                            |
| `format`         | `number`  | `gl.RGBA`          | Texture data format                                |
| `type`           | `number`  | `gl.UNSIGNED_BYTE` | Texture data type                                  |
| `minFilter`      | `number`  | `gl.LINEAR`        | Texture minification filter                        |
| `magFilter`      | `number`  | `gl.LINEAR`        | Texture magnification filter                       |
| `wrapS`          | `number`  | `gl.CLAMP_TO_EDGE` | Horizontal texture wrapping                        |
| `wrapT`          | `number`  | `gl.CLAMP_TO_EDGE` | Vertical texture wrapping                          |
| `depth`          | `boolean` | `false`            | Adds `DEPTH_COMPONENT16` renderbuffer storage      |
| `stencil`        | `boolean` | `false`            | Adds combined `DEPTH_STENCIL` renderbuffer storage |

### Properties

| Property       | Type                                              | Notes                             |
| -------------- | ------------------------------------------------- | --------------------------------- |
| `gl`           | `WebGLRenderingContext \| WebGL2RenderingContext` | Context passed to the constructor |
| `width`        | `number`                                          | Current framebuffer width         |
| `height`       | `number`                                          | Current framebuffer height        |
| `framebuffer`  | `WebGLFramebuffer`                                | Underlying framebuffer object     |
| `texture`      | `WebGLTexture`                                    | Color attachment texture          |
| `renderbuffer` | `WebGLRenderbuffer \| null`                       | Depth or depth-stencil storage    |
| `disposed`     | `boolean`                                         | `true` after disposal             |

### Methods

| Method                      | Purpose                                                    |
| --------------------------- | ---------------------------------------------------------- |
| `bind()`                    | Bind this framebuffer as the active draw/read target       |
| `unbind()`                  | Bind the default screen framebuffer                        |
| `withBound(render)`         | Bind, run a callback, and unbind in a `finally` block      |
| `resize({ width, height })` | Reallocate texture and renderbuffer storage                |
| `resizeToCanvas(canvas)`    | Resize to a canvas backing-store size                      |
| `readPixels()`              | Read RGBA pixels into a `Uint8Array`                       |
| `dispose()`                 | Delete the framebuffer, texture, and optional renderbuffer |

`FBO` is exported as a compatibility alias for `Framebuffer`.

## Error Behavior

The library throws early for:

- non-WebGL context values
- non-integer or non-positive dimensions
- failed WebGL resource allocation
- incomplete framebuffer status
- use after `dispose()`

Base WebGL failures extend `WebGLError`. Use-after-dispose failures throw `DisposedResourceError`.

## Other Resource APIs

| Module                      | Primary exports                    | Purpose                                                   |
| --------------------------- | ---------------------------------- | --------------------------------------------------------- |
| `webgraphiclibrary/shader`  | `Shader`                           | Compile a WebGL shader and clean up on compile failure    |
| `webgraphiclibrary/program` | `Program`                          | Link vertex/fragment shaders and resolve uniforms/attribs |
| `webgraphiclibrary/buffer`  | `GLBuffer`                         | Upload typed array data or allocate buffer storage        |
| `webgraphiclibrary/texture` | `Texture2D`, `readTexturePixels`   | Allocate/upload textures and inspect texture pixels       |
| `webgraphiclibrary/core`    | `WebGLError`, validation utilities | Shared errors and low-level guards                        |

## Project Snapshots

These screenshots are generated by `pnpm screenshots` from the current build and demo.

![Scoped framebuffer code snippet](docs/screenshots/code-snippet.png)

![Release verification terminal](docs/screenshots/terminal-verification.png)

Suggested next media additions:

- `docs/screenshots/fbo-resize.gif`: resize a canvas and show the off-screen target updating.
- `docs/screenshots/read-pixels.gif`: demonstrate a simple picking/readback workflow.
- `docs/screenshots/debug-texture.png`: show a texture inspection helper in a real render pipeline.

## Architecture

The package is a small workspace with private implementation packages and one public npm package.

```text
packages/core      Shared WebGL context checks, dimension validation, and error types
packages/fbo       Framebuffer resource wrapper and tests
packages/shader    Shader compile wrapper and tests
packages/program   Program link and lookup wrapper and tests
packages/buffer    Typed buffer upload wrapper and tests
packages/texture   Texture allocation and readback wrapper and tests
examples           Browser examples that consume the built public package
docs/assets        Static diagrams and generated screenshots
scripts            Playwright screenshot and release-verification tooling
dist               Published ESM and TypeScript declaration output
```

The root package exposes compiled modules through `exports`:

```json
{
  ".": "./dist/index.js",
  "./buffer": "./dist/buffer.js",
  "./core": "./dist/core.js",
  "./fbo": "./dist/fbo.js",
  "./program": "./dist/program.js",
  "./shader": "./dist/shader.js",
  "./texture": "./dist/texture.js"
}
```

## Development

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm verify
```

`pnpm verify` is the release gate. It checks formatting, regenerates screenshots, runs linting, type checking, tests, and build through `prepublishOnly`, then inspects the npm package contents.

## Release

The beta package is published to npm as:

```bash
npm install webgraphiclibrary@beta
```

For release steps, see [docs/release.md](docs/release.md).

## Roadmap

The v2 line is rebuilding earlier WebGraphicLibrary packages as small, typed WebGL resource modules.

Next planned work:

- richer uniform setter helpers
- attribute layout helpers for `GLBuffer`
- texture display and debugging examples
- WebGL2-first framebuffer options, including multisample renderbuffers and multiple render targets
- benchmarks and package-size comparison docs

Sprite helpers are intentionally outside the first v2 scope. They fit better as examples built on top of lower-level primitives.

## Contributing

Contributions should keep the library close to WebGL, typed, and easy to inspect.

Before opening a pull request:

```bash
pnpm verify
```

Contribution guidelines:

- Keep APIs focused on one WebGL resource or workflow.
- Prefer explicit lifecycle methods over hidden global state.
- Preserve access to raw WebGL handles.
- Add tests for validation, lifecycle behavior, error paths, and WebGL state restoration.
- Update examples, screenshots, and the README when public behavior changes.

## Security

webgraphiclibrary is a local rendering utility package. It does not make network requests, store credentials, or process server-side user input.

Please report security issues through GitHub Issues with a minimal reproduction and affected package version. See [SECURITY.md](SECURITY.md).

## License

MIT
