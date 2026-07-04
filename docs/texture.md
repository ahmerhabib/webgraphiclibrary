# Texture2D

`import { Texture2D, readTexturePixels, readTexturePixelsInto } from "webgraphiclibrary/texture";`

Allocates and uploads a 2D texture from typed-array data or an image source, and reads pixels back through a temporary framebuffer.

```ts
const texture = new Texture2D(gl, { width: 256, height: 256 });

// From an image, canvas, video, ImageBitmap, or ImageData:
texture.uploadImage(imageBitmap);
texture.generateMipmap();
```

## Constructor options

| Option             | Type                      | Default            | Notes                                       |
| ------------------ | ------------------------- | ------------------ | ------------------------------------------- |
| `width`            | `number`                  | required           | Positive integer width                      |
| `height`           | `number`                  | required           | Positive integer height                     |
| `internalFormat`   | `number`                  | `gl.RGBA`          | Texture internal format                     |
| `format`           | `number`                  | `gl.RGBA`          | Texture data format                         |
| `type`             | `number`                  | `gl.UNSIGNED_BYTE` | Texture data type                           |
| `minFilter`        | `number`                  | `gl.LINEAR`        | Minification filter                         |
| `magFilter`        | `number`                  | `gl.LINEAR`        | Magnification filter                        |
| `wrapS` / `wrapT`  | `number`                  | `gl.CLAMP_TO_EDGE` | Wrap modes                                  |
| `data`             | `ArrayBufferView \| null` | `null`             | Initial pixel data                          |
| `image`            | `TextureImageSource`      | —                  | Upload from an image source at construction |
| `flipY`            | `boolean`                 | `false`            | `UNPACK_FLIP_Y_WEBGL` for image uploads     |
| `premultiplyAlpha` | `boolean`                 | `false`            | `UNPACK_PREMULTIPLY_ALPHA_WEBGL`            |

`TextureImageSource` = `HTMLImageElement | HTMLCanvasElement | HTMLVideoElement | ImageBitmap | ImageData`.

## Methods

| Method                | Purpose                                                       |
| --------------------- | ------------------------------------------------------------- |
| `bind()` / `unbind()` | Bind / unbind on `TEXTURE_2D`                                 |
| `withBound(render)`   | Bind, run `render`, restore the previous texture binding      |
| `upload(options)`     | Reallocate from typed-array data (`{ width, height, data? }`) |
| `uploadImage(source)` | Upload from an image source; tracks the source's size         |
| `generateMipmap()`    | Generate a mipmap chain                                       |
| `dispose()`           | Delete the texture (idempotent)                               |

## Readback

| Function                                  | Purpose                                  |
| ----------------------------------------- | ---------------------------------------- |
| `readTexturePixels(gl, texture)`          | Read RGBA pixels into a new `Uint8Array` |
| `readTexturePixelsInto(gl, texture, out)` | Read into a caller-provided array        |

Both attach the texture to a temporary framebuffer, read `RGBA` / `UNSIGNED_BYTE`, and restore bindings.
