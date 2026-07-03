# FBO post-process workflow

This example is the first visual acceptance target for webgraphiclibrary v2.

It uses the package's `Framebuffer` wrapper for the off-screen render target, then keeps the rest of the WebGL pipeline intentionally raw. That makes the workflow easy to inspect:

1. Create a `Framebuffer` with a color texture and optional depth storage.
2. Render the scene while the framebuffer is bound.
3. Unbind the framebuffer.
4. Sample `framebuffer.texture` in a screen-space pass.
5. Resize and dispose the framebuffer with the rest of the render lifecycle.

Run `pnpm build` first, then open `index.html` through a local server. The repository screenshot script does this automatically when you run:

```bash
pnpm screenshots
```

![FBO post-process demo](../../docs/screenshots/fbo-postprocess-demo.png)
