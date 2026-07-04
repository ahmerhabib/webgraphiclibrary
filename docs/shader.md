# Shader

`import { Shader } from "webgraphiclibrary/shader";`

Compiles a single WebGL shader and cleans up on failure. Compile errors are thrown as a `WebGLError` annotated with the shader stage and the numbered source with the failing line marked.

```ts
const vertex = new Shader(gl, {
  type: gl.VERTEX_SHADER,
  source: "attribute vec2 position; void main() { gl_Position = vec4(position, 0.0, 1.0); }"
});
```

## Constructor options

| Option   | Type     | Notes                                      |
| -------- | -------- | ------------------------------------------ |
| `type`   | `number` | `gl.VERTEX_SHADER` or `gl.FRAGMENT_SHADER` |
| `source` | `string` | GLSL source                                |

## Properties

| Property   | Type          | Notes                    |
| ---------- | ------------- | ------------------------ |
| `gl`       | `GLContext`   | The context passed in    |
| `shader`   | `WebGLShader` | Underlying shader handle |
| `type`     | `number`      | The shader type          |
| `disposed` | `boolean`     | `true` after `dispose()` |

## Methods

| Method           | Purpose                                   |
| ---------------- | ----------------------------------------- |
| `assertUsable()` | Throw `DisposedResourceError` if disposed |
| `dispose()`      | Delete the shader (idempotent)            |

A `Shader` can be passed directly to a [`Program`](./program.md); the program unwraps it to the raw handle. You may dispose shaders after the program links.
