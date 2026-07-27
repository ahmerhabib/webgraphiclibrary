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

# CubemapTexture

A cube texture (`TEXTURE_CUBE_MAP`) for skyboxes, environment maps, and reflections. Six square faces are allocated together in `+X, -X, +Y, -Y, +Z, -Z` order (face `i` maps to `gl.TEXTURE_CUBE_MAP_POSITIVE_X + i`); sample it in GLSL with `samplerCube`.

```ts
import { CubemapTexture } from "webgraphiclibrary/texture";

const sky = new CubemapTexture(gl, {
  size: 512,
  faces: [posX, negX, posY, negY, posZ, negZ] // six loaded images
});
sky.generateMipmap();
```

## Constructor options

| Option                             | Type                           | Default                           | Notes                                                |
| ---------------------------------- | ------------------------------ | --------------------------------- | ---------------------------------------------------- |
| `size`                             | `number`                       | required                          | Edge length of each square face (positive integer)   |
| `internalFormat`, `format`, `type` | `number`                       | `RGBA` / `RGBA` / `UNSIGNED_BYTE` | Storage formats                                      |
| `minFilter`, `magFilter`           | `number`                       | `LINEAR`                          | Sampler filters                                      |
| `wrapS`, `wrapT`                   | `number`                       | `CLAMP_TO_EDGE`                   | Wrap modes                                           |
| `data`                             | `(ArrayBufferView \| null)[6]` | six empty faces                   | Per-face pixel data                                  |
| `faces`                            | `TextureImageSource[6]`        | —                                 | Per-face image sources, all matching `size`          |
| `flipY`, `premultiplyAlpha`        | `boolean`                      | `false`                           | Pixel-store state for image uploads (restored after) |

## Methods

| Method                       | Purpose                                                  |
| ---------------------------- | -------------------------------------------------------- |
| `bind()` / `unbind()`        | Bind / unbind on `TEXTURE_CUBE_MAP`                      |
| `withBound(render)`          | Bind, run `render`, restore the previous cubemap binding |
| `uploadFace(face, source)`   | Upload one face from an image source (must match `size`) |
| `uploadFaceData(face, data)` | Reallocate one face from typed-array data (or `null`)    |
| `generateMipmap()`           | Generate a mipmap chain for all faces                    |
| `dispose()`                  | Delete the texture (idempotent)                          |

Invalid face indices, wrong-sized sources, and zero-sized (not-yet-loaded) images throw `RangeError` before any GL state is touched. See the [skybox example](../examples/skybox) for a complete render.
