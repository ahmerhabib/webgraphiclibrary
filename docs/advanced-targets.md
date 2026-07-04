# Advanced render targets (WebGL2)

Two WebGL2-only off-screen targets sit alongside [`Framebuffer`](./framebuffer.md) for deferred and anti-aliased rendering. Both throw a clear error on a WebGL1 context, restore the bindings they touch, and expose their raw handles.

## MultiTarget — multiple render targets (MRT)

`import { MultiTarget } from "webgraphiclibrary/fbo";`

Renders to several sampleable color attachments at once — the basis of G-buffers and deferred shading.

```ts
const gbuffer = new MultiTarget(gl, {
  width: canvas.width,
  height: canvas.height,
  attachments: [
    {}, // albedo    (RGBA / UNSIGNED_BYTE)
    { internalFormat: gl.RGBA16F, type: gl.HALF_FLOAT } // normals
  ],
  depth: true
});

gbuffer.withBound(() => {
  gl.viewport(0, 0, gbuffer.width, gbuffer.height);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  drawScene(); // fragment shader writes to layout(location = 0/1) out vec4
});

// Sample any attachment in the lighting pass:
gl.bindTexture(gl.TEXTURE_2D, gbuffer.textures[0]);
```

`attachments` is a count of RGBA attachments (default `2`) or an array of per-attachment [`ColorAttachmentSpec`](../packages/fbo/src/multi-target.ts) format options. `drawBuffers` is wired automatically. Read a specific attachment with `readPixels(index)` / `readPixelsInto(out, index)`. `texture` aliases `textures[0]`.

## MultisampleTarget — anti-aliased off-screen rendering

`import { MultisampleTarget } from "webgraphiclibrary/fbo";`

Renders into a multisampled renderbuffer, then resolves (blits) into a normal sampleable texture.

```ts
const aa = new MultisampleTarget(gl, { width, height, samples: 4, depth: true });

aa.withBound(() => {
  gl.viewport(0, 0, aa.width, aa.height);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  drawScene();
});

aa.resolve(); // blit the multisampled buffer into aa.texture
gl.bindTexture(gl.TEXTURE_2D, aa.texture); // now sampleable
```

`samples` is clamped to the context's `MAX_SAMPLES`. Call `resolve()` after rendering and before sampling `texture`; `readPixels()` reads the resolved image.
