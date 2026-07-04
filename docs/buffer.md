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

| Option   | Type                     | Default          | Notes                                          |
| -------- | ------------------------ | ---------------- | ---------------------------------------------- |
| `target` | `number`                 | required         | `gl.ARRAY_BUFFER` or `gl.ELEMENT_ARRAY_BUFFER` |
| `usage`  | `number`                 | `gl.STATIC_DRAW` | Usage hint                                     |
| `data`   | `BufferSource \| number` | —                | Initial data, or a byte size to allocate       |

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
