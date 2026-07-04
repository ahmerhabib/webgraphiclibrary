# Framebuffer

`import { Framebuffer, FBO } from "webgraphiclibrary/fbo";`

An off-screen render target: a color texture with optional depth or depth-stencil renderbuffer storage. `FBO` is an alias for `Framebuffer`.

```ts
const target = new Framebuffer(gl, { width: 1024, height: 1024, depth: true });

target.withBound(() => {
  gl.viewport(0, 0, target.width, target.height);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  drawScene();
});

gl.bindTexture(gl.TEXTURE_2D, target.texture);
```

## Constructor options

| Option           | Type      | Default            | Notes                                                                                       |
| ---------------- | --------- | ------------------ | ------------------------------------------------------------------------------------------- |
| `width`          | `number`  | required           | Positive integer width                                                                      |
| `height`         | `number`  | required           | Positive integer height                                                                     |
| `internalFormat` | `number`  | `gl.RGBA`          | Color texture internal format                                                               |
| `format`         | `number`  | `gl.RGBA`          | Color texture data format                                                                   |
| `type`           | `number`  | `gl.UNSIGNED_BYTE` | Color texture data type (`gl.FLOAT` enables the color-buffer-float extension automatically) |
| `minFilter`      | `number`  | `gl.LINEAR`        | Minification filter                                                                         |
| `magFilter`      | `number`  | `gl.LINEAR`        | Magnification filter                                                                        |
| `wrapS`          | `number`  | `gl.CLAMP_TO_EDGE` | Horizontal wrap                                                                             |
| `wrapT`          | `number`  | `gl.CLAMP_TO_EDGE` | Vertical wrap                                                                               |
| `depth`          | `boolean` | `false`            | Adds a `DEPTH_COMPONENT16` renderbuffer                                                     |
| `stencil`        | `boolean` | `false`            | Adds a combined `DEPTH_STENCIL` renderbuffer                                                |

## Properties

| Property       | Type                        | Notes                         |
| -------------- | --------------------------- | ----------------------------- |
| `gl`           | `GLContext`                 | The context passed in         |
| `framebuffer`  | `WebGLFramebuffer`          | Underlying framebuffer object |
| `texture`      | `WebGLTexture`              | Color attachment texture      |
| `renderbuffer` | `WebGLRenderbuffer \| null` | Depth/stencil storage, if any |
| `width`        | `number`                    | Current width                 |
| `height`       | `number`                    | Current height                |
| `disposed`     | `boolean`                   | `true` after `dispose()`      |

## Methods

| Method                      | Purpose                                                            |
| --------------------------- | ------------------------------------------------------------------ |
| `bind()` / `unbind()`       | Bind this target / bind the default framebuffer                    |
| `withBound(render)`         | Bind, run `render`, restore the previous framebuffer binding       |
| `resize({ width, height })` | Reallocate storage; reverts dimensions if the result is incomplete |
| `resizeToCanvas(canvas)`    | Resize to a canvas backing-store size                              |
| `readPixels()`              | Read RGBA pixels into a new `Uint8Array`                           |
| `readPixelsInto(out)`       | Read into a caller-provided array (no per-call allocation)         |
| `invalidate(attachments?)`  | WebGL2 hint that attachment contents can be discarded              |
| `dispose()`                 | Delete the framebuffer, texture, and renderbuffer (idempotent)     |

`readPixels` currently supports `RGBA` / `UNSIGNED_BYTE` targets. `invalidate` throws on a WebGL1 context.
