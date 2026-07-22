# VertexArray (WebGL2)

`import { VertexArray } from "webgraphiclibrary/vao";`

Wraps a `WebGLVertexArrayObject` (VAO). Record your vertex attribute setup once — every pointer, enable flag, instancing divisor, and the `ELEMENT_ARRAY_BUFFER` binding — then restore all of it with a single bind at draw time. `withBound` also restores whatever vertex array the caller had bound, so recording never disturbs surrounding state.

```ts
import { VertexArray } from "webgraphiclibrary/vao";

const vao = new VertexArray(gl);

// Record once: attribute pointers configured while the VAO is bound are captured.
vao.withBound(() => {
  program.enableAttribute("position", { buffer: quad, size: 2 });
  program.enableAttribute("offset", { buffer: instances, size: 2, divisor: 1 });
});

// Draw: one bind restores the whole layout.
program.withUsed(() => {
  vao.withBound(() => {
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 3, count);
  });
});
```

## Constructor

`new VertexArray(gl)` — requires a WebGL2 context. Throws `TypeError` for a non-context and `WebGLError` on WebGL1 or if creation fails.

## Properties

| Property      | Type                     | Notes                          |
| ------------- | ------------------------ | ------------------------------ |
| `gl`          | `WebGL2RenderingContext` | The context passed in          |
| `vertexArray` | `WebGLVertexArrayObject` | Underlying vertex array handle |
| `disposed`    | `boolean`                | `true` after `dispose()`       |

## Methods

| Method                | Purpose                                                       |
| --------------------- | ------------------------------------------------------------- |
| `bind()` / `unbind()` | Bind / unbind the vertex array                                |
| `withBound(render)`   | Bind, run `render`, restore the previously bound vertex array |
| `dispose()`           | Delete the vertex array (idempotent)                          |

## Notes

- Attribute state configured while the VAO is bound (for example via `Program.enableAttribute`) is captured by the VAO — including `ELEMENT_ARRAY_BUFFER`, so index-buffer binds belong inside the recording callback too.
- `Program.enableAttribute` restores the `ARRAY_BUFFER` binding it touches, which is safe: a VAO captures attribute _pointer_ state, not the `ARRAY_BUFFER` binding itself.
- See the [instancing example](../examples/instancing) for a full VertexArray + UniformBuffer render.
