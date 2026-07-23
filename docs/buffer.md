# GLBuffer

`import { GLBuffer } from "webgraphiclibrary/buffer";`

Wraps a `WebGLBuffer` with typed uploads and partial updates. Binding is saved and restored around uploads.

```ts
const vertices = new GLBuffer(gl, {
  target: gl.ARRAY_BUFFER,
  data: new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
  usage: gl.STATIC_DRAW
});

vertices.updateSubData(0, new Float32Array([-0.5, -0.5]));
```

## Constructor options

| Option   | Type                     | Default          | Notes                                                                                                                        |
| -------- | ------------------------ | ---------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `target` | `number`                 | required         | `gl.ARRAY_BUFFER` or `gl.ELEMENT_ARRAY_BUFFER`; WebGL2 also accepts the copy, pixel, transform-feedback, and uniform targets |
| `usage`  | `number`                 | `gl.STATIC_DRAW` | Usage hint                                                                                                                   |
| `data`   | `BufferSource \| number` | —                | Initial data, or a byte size to allocate                                                                                     |

## Properties

| Property     | Type          | Notes                            |
| ------------ | ------------- | -------------------------------- |
| `gl`         | `GLContext`   | The context passed in            |
| `buffer`     | `WebGLBuffer` | Underlying buffer handle         |
| `target`     | `number`      | The bind target                  |
| `usage`      | `number`      | Current usage hint               |
| `byteLength` | `number`      | Size of the last upload in bytes |
| `disposed`   | `boolean`     | `true` after `dispose()`         |

## Methods

| Method                        | Purpose                                                              |
| ----------------------------- | -------------------------------------------------------------------- |
| `bind()` / `unbind()`         | Bind / unbind this buffer on its target                              |
| `withBound(render)`           | Bind, run `render`, restore the previous binding                     |
| `upload(data, usage?)`        | Reallocate with new data or a byte size                              |
| `updateSubData(offset, data)` | `bufferSubData` partial write; validates it fits within `byteLength` |
| `dispose()`                   | Delete the buffer (idempotent)                                       |

# UniformBuffer (WebGL2)

`import { UniformBuffer } from "webgraphiclibrary/buffer";`

A uniform buffer object (UBO): one `std140` uniform block shared by any number of programs through an indexed binding point. Allocate it, wire each program's block with `connect`, attach the buffer with `bindTo`, then stream per-frame values with `update` — no per-program `setUniform*` calls. Uploads save and restore the previous `UNIFORM_BUFFER` binding.

```ts
// GLSL: uniform Params { vec4 tint; vec2 spin; };
const params = new UniformBuffer(gl, { data: 32 });
params.connect(program, "Params", 0);
params.bindTo(0);

// Per frame — one upload updates every connected program.
params.update(new Float32Array([1, 0, 1, 1, 0.65, 1.05]));
```

## Constructor options

| Option  | Type                     | Default           | Notes                                    |
| ------- | ------------------------ | ----------------- | ---------------------------------------- |
| `data`  | `BufferSource \| number` | required          | Initial data, or a byte size to allocate |
| `usage` | `number`                 | `gl.DYNAMIC_DRAW` | Uniform data usually changes often       |

## Properties

| Property     | Type                     | Notes                    |
| ------------ | ------------------------ | ------------------------ |
| `gl`         | `WebGL2RenderingContext` | The context passed in    |
| `buffer`     | `WebGLBuffer`            | Underlying buffer handle |
| `usage`      | `number`                 | Usage hint               |
| `byteLength` | `number`                 | Allocated size in bytes  |
| `disposed`   | `boolean`                | `true` after `dispose()` |

## Methods

| Method                               | Purpose                                                                                       |
| ------------------------------------ | --------------------------------------------------------------------------------------------- |
| `connect(program, blockName, index)` | Wire a program's named uniform block to binding point `index`; throws if the block is missing |
| `bindTo(index)`                      | Attach the whole buffer to binding point `index` (`bindBufferBase`)                           |
| `bindRange(index, byteOffset, size)` | Attach a slice to a binding point (`bindBufferRange`)                                         |
| `update(data, byteOffset?)`          | `bufferSubData` write; validates it fits within `byteLength`                                  |
| `dispose()`                          | Delete the buffer (idempotent)                                                                |

Remember `std140` layout rules: a `vec3` occupies 16 bytes, arrays round each element up to 16 bytes, and the block itself is padded. When in doubt, build the block from `vec4`s.
