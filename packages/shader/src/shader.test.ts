import { describe, expect, it } from "vitest";
import { Shader } from "./index";

type Call = [name: string, ...args: unknown[]];

function createMockGL(overrides: Record<string, unknown> = {}) {
  const calls: Call[] = [];
  const shader = { type: "shader" };

  const gl = {
    calls,
    VERTEX_SHADER: 0x8b31,
    FRAGMENT_SHADER: 0x8b30,
    COMPILE_STATUS: 0x8b81,
    createFramebuffer: () => ({}),
    bindFramebuffer: () => undefined,
    checkFramebufferStatus: () => 0x8cd5,
    createShader: () => shader,
    shaderSource: (...args: unknown[]) => calls.push(["shaderSource", ...args]),
    compileShader: (...args: unknown[]) => calls.push(["compileShader", ...args]),
    getShaderParameter: () => true,
    getShaderInfoLog: () => "",
    deleteShader: (...args: unknown[]) => calls.push(["deleteShader", ...args]),
    ...overrides
  } as unknown as WebGLRenderingContext & { calls: Call[] };

  return gl;
}

describe("Shader", () => {
  it("rejects a non-WebGL rendering context", () => {
    expect(
      () => new Shader({} as unknown as WebGLRenderingContext, { type: 0x8b31, source: "" })
    ).toThrow("gl must be a WebGL rendering context.");
  });

  it("compiles a shader from source", () => {
    const gl = createMockGL();
    const shader = new Shader(gl, {
      type: gl.VERTEX_SHADER,
      source: "attribute vec2 position; void main() { gl_Position = vec4(position, 0.0, 1.0); }"
    });

    expect(shader.shader).toBeTruthy();
    expect(shader.type).toBe(gl.VERTEX_SHADER);
    expect(gl.calls.some(([name]) => name === "shaderSource")).toBe(true);
    expect(gl.calls.some(([name]) => name === "compileShader")).toBe(true);
  });

  it("deletes the shader when compilation fails", () => {
    const gl = createMockGL({
      getShaderParameter: () => false,
      getShaderInfoLog: () => "syntax error"
    });

    expect(() => new Shader(gl, { type: gl.FRAGMENT_SHADER, source: "bad" })).toThrow(
      "syntax error"
    );
    expect(gl.calls.filter(([name]) => name === "deleteShader")).toHaveLength(1);
  });

  it("annotates compile errors with the shader stage and numbered source", () => {
    const gl = createMockGL({
      getShaderParameter: () => false,
      getShaderInfoLog: () => "ERROR: 0:2: 'x' : undeclared identifier"
    });
    const source = "void main() {\n  x();\n}";
    const make = () => new Shader(gl, { type: gl.FRAGMENT_SHADER, source });

    expect(make).toThrow("fragment shader");
    expect(make).toThrow("undeclared identifier");
    expect(make).toThrow("> 2 |");
  });

  it("disposes once and rejects use-after-dispose assertions", () => {
    const gl = createMockGL();
    const shader = new Shader(gl, { type: gl.FRAGMENT_SHADER, source: "void main() {}" });

    shader.dispose();
    shader.dispose();

    expect(shader.disposed).toBe(true);
    expect(gl.calls.filter(([name]) => name === "deleteShader")).toHaveLength(1);
    expect(() => shader.assertUsable()).toThrow("Shader has been disposed.");
  });
});
