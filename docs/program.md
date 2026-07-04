# Program

`import { Program } from "webgraphiclibrary/program";`

Links a vertex and fragment shader, and provides cached uniform/attribute lookups plus typed setters. Link failures throw a `WebGLError` prefixed with `Failed to link program:` and the info log.

```ts
const program = new Program(gl, { vertexShader, fragmentShader });

program.withUsed(() => {
  program
    .setUniform2f("resolution", width, height)
    .setUniform1f("time", t)
    .setTexture("source", framebuffer.texture, 0)
    .enableAttribute("position", { buffer: quad, size: 2 });

  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
});
```

`vertexShader` / `fragmentShader` accept either a raw `WebGLShader` or a [`Shader`](./shader.md).

## Lifecycle

| Method          | Purpose                                                   |
| --------------- | --------------------------------------------------------- |
| `use()`         | `useProgram(this.program)`                                |
| `withUsed(run)` | Use this program, run `run`, restore the previous program |
| `dispose()`     | Delete the program (idempotent)                           |

## Uniforms

Uniform locations are looked up once and cached. Setters apply to the currently used program (call `use()` or wrap in `withUsed`) and return `this` for chaining. Missing uniforms resolve to `null`, which WebGL treats as a no-op, so optimized-out uniforms never throw at set time.

| Method                                                  | WebGL call                                    |
| ------------------------------------------------------- | --------------------------------------------- |
| `tryGetUniformLocation(name)`                           | cached, returns `null` if absent              |
| `getUniformLocation(name)`                              | throws if absent                              |
| `setUniform1f/2f/3f/4f(name, …)`                        | `uniform1f`…`uniform4f`                       |
| `setUniform1i(name, x)`                                 | `uniform1i`                                   |
| `setUniform1fv/2fv/3fv/4fv(name, values)`               | `uniform1fv`…`uniform4fv`                     |
| `setUniformMatrix2fv/3fv/4fv(name, values, transpose?)` | `uniformMatrix*fv`                            |
| `setTexture(name, texture, unit)`                       | `activeTexture` + `bindTexture` + `uniform1i` |

`setTexture` accepts a raw `WebGLTexture` or any `{ texture }` wrapper such as a [`Texture2D`](./texture.md) or [`Framebuffer`](./framebuffer.md).

## Attributes

| Method                          | Purpose                                                                  |
| ------------------------------- | ------------------------------------------------------------------------ |
| `getAttribLocation(name)`       | Throws if the attribute is absent                                        |
| `enableAttribute(name, layout)` | Bind buffer, enable, and set the vertex pointer; restores `ARRAY_BUFFER` |

`AttributeLayout`: `{ buffer, size, type?, normalized?, stride?, offset?, divisor? }`. `buffer` accepts a raw `WebGLBuffer` or a [`GLBuffer`](./buffer.md). `divisor` (instanced attributes) requires a WebGL2 context.
