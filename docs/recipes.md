# Recipes

Copy-paste solutions to common tasks. Every snippet assumes a `gl` context and uses only the public API.

## Get a context

```ts
const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
if (gl === null) throw new Error("WebGL is not available.");
```

## Compile and link a program (with clear errors)

```ts
import { Shader } from "webgraphiclibrary/shader";
import { Program } from "webgraphiclibrary/program";

// Throws a WebGLError annotated with the stage + numbered source on failure.
const program = new Program(gl, {
  vertexShader: new Shader(gl, { type: gl.VERTEX_SHADER, source: vertexSource }),
  fragmentShader: new Shader(gl, { type: gl.FRAGMENT_SHADER, source: fragmentSource })
});
```

## Draw geometry with uniforms and attributes

```ts
import { GLBuffer } from "webgraphiclibrary/buffer";

const quad = new GLBuffer(gl, {
  target: gl.ARRAY_BUFFER,
  data: new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1])
});

program.withUsed(() => {
  program
    .setUniform2f("resolution", canvas.width, canvas.height)
    .setUniform1f("time", performance.now() / 1000)
    .enableAttribute("position", { buffer: quad, size: 2 });
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
});
```

## Render to a texture (off-screen)

```ts
import { Framebuffer } from "webgraphiclibrary/fbo";

const target = new Framebuffer(gl, { width: 1024, height: 1024, depth: true });
target.withBound(() => {
  gl.viewport(0, 0, target.width, target.height);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  drawScene();
});
gl.bindTexture(gl.TEXTURE_2D, target.texture); // sample it in a later pass
```

## Full-screen post-processing pass

```ts
// Pass 1: render the scene into `sceneFbo` (see the recipe above).
// Pass 2: sample it and write to the screen.
gl.viewport(0, 0, canvas.width, canvas.height);
screenProgram.withUsed(() => {
  screenProgram.setTexture("source", sceneFbo.texture, 0); // accepts a Texture2D or raw handle
  screenProgram.enableAttribute("position", { buffer: quad, size: 2 });
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
});
```

## Object picking (read one pixel back, no per-frame allocation)

```ts
const pixel = new Uint8Array(4);
pickTarget.withBound(() => renderEncodedIds());
pickTarget.readPixelsInto(pixel); // reuse the same array every frame
const id = pixel[0] | (pixel[1] << 8) | (pixel[2] << 16);
```

## Texture from an image URL

```ts
import { Texture2D } from "webgraphiclibrary/texture";

const bitmap = await createImageBitmap(await (await fetch("/tile.png")).blob());
const texture = new Texture2D(gl, { width: 1, height: 1, image: bitmap, flipY: true });
texture.generateMipmap();
```

## Stream a video into a texture

```ts
const texture = new Texture2D(gl, { width: 1, height: 1 });
function frame() {
  if (video.readyState >= video.HAVE_CURRENT_DATA) texture.uploadImage(video);
  requestAnimationFrame(frame);
}
```

## Keep a render target the same size as the canvas

```ts
if (canvas.width !== target.width || canvas.height !== target.height) {
  target.resizeToCanvas(canvas); // reallocates, revalidates, restores bindings
}
```

## Multiple render targets (a G-buffer)

```ts
import { MultiTarget } from "webgraphiclibrary/fbo";

const gbuffer = new MultiTarget(gl, {
  width: canvas.width,
  height: canvas.height,
  attachments: [{}, { internalFormat: gl.RGBA16F, type: gl.HALF_FLOAT }], // albedo, normals
  depth: true
});

gbuffer.withBound(() => {
  gl.viewport(0, 0, gbuffer.width, gbuffer.height);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  drawScene(); // fragment shader writes layout(location = 0/1) out vec4
});
gl.bindTexture(gl.TEXTURE_2D, gbuffer.textures[1]); // sample the normals in a lighting pass
```

## Anti-aliased off-screen rendering (MSAA)

```ts
import { MultisampleTarget } from "webgraphiclibrary/fbo";

const aa = new MultisampleTarget(gl, { width, height, samples: 4, depth: true });
aa.withBound(() => {
  gl.viewport(0, 0, aa.width, aa.height);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  drawScene();
});
aa.resolve(); // blit the multisampled buffer into aa.texture
gl.bindTexture(gl.TEXTURE_2D, aa.texture); // now sampleable
```

## Float / HDR render target

```ts
// `type: gl.FLOAT` auto-enables EXT_color_buffer_float on WebGL2.
const hdr = new Framebuffer(gl, {
  width,
  height,
  internalFormat: gl.RGBA16F,
  format: gl.RGBA,
  type: gl.HALF_FLOAT
});
```

## Update part of a buffer without reallocating

```ts
const buffer = new GLBuffer(gl, { target: gl.ARRAY_BUFFER, data: new Float32Array(1024) });
buffer.updateSubData(64, new Float32Array([1, 2, 3, 4])); // write 16 bytes at offset 64
```

## Handle typed errors

```ts
import { WebGLError, DisposedResourceError } from "webgraphiclibrary/core";

try {
  new Shader(gl, { type: gl.FRAGMENT_SHADER, source: brokenSource });
} catch (error) {
  if (error instanceof WebGLError) console.error(error.message); // stage + numbered source
}
```

## Clean up

```ts
program.dispose();
quad.dispose();
target.dispose(); // idempotent; using a resource after dispose() throws DisposedResourceError
```
