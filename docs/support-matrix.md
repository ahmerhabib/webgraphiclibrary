# Support matrix

What each capability requires. "WebGL1" means core WebGL 1; "WebGL2" means a WebGL 2 context; "ext" means a WebGL1 extension is enabled automatically or must be present.

| Capability                        | WebGL1                                                | WebGL2                              | Notes                                                            |
| --------------------------------- | ----------------------------------------------------- | ----------------------------------- | ---------------------------------------------------------------- |
| Color framebuffer + depth/stencil | Yes                                                   | Yes                                 | `depth` uses `DEPTH_COMPONENT16`; `stencil` uses `DEPTH_STENCIL` |
| RGBA / UNSIGNED_BYTE readback     | Yes                                                   | Yes                                 | `readPixels` / `readTexturePixels` support this format           |
| Float render targets              | ext (`OES_texture_float`, `WEBGL_color_buffer_float`) | `EXT_color_buffer_float`            | Extensions are requested automatically for `type: gl.FLOAT`      |
| Half-float render targets         | ext (`OES_texture_half_float`)                        | ext (`EXT_color_buffer_half_float`) | Requested automatically for a half-float `type`                  |
| Texture from image/canvas/video   | Yes                                                   | Yes                                 | `Texture2D.uploadImage` / `image` option                         |
| Mipmaps                           | Yes (power-of-two)                                    | Yes                                 | `generateMipmap`; NPOT mipmaps need WebGL2                       |
| NPOT textures                     | Clamp + non-mip only                                  | Yes                                 | Defaults (`CLAMP_TO_EDGE`, `LINEAR`) are NPOT-safe on WebGL1     |
| Instanced attributes (`divisor`)  | No                                                    | Yes                                 | `enableAttribute({ divisor })` throws on WebGL1                  |
| `invalidateFramebuffer`           | No                                                    | Yes                                 | `Framebuffer.invalidate` throws on WebGL1                        |
| Compressed textures               | Not wrapped                                           | Not wrapped                         | Use the raw handle + `compressedTexImage2D`                      |
| Multisample renderbuffers / blit  | No                                                    | Yes (`MultisampleTarget`)           | Render, then `resolve()` blits into a sampleable texture         |
| Multiple render targets (MRT)     | No                                                    | Yes (`MultiTarget`)                 | Several sampleable color attachments wired with `drawBuffers`    |

Anything not wrapped is still reachable: every resource exposes its raw handle (`framebuffer.framebuffer`, `texture.texture`, …) so you can drop to raw WebGL where needed.
