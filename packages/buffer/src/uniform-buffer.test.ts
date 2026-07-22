import { describe, expect, it } from "vitest";
import { UniformBuffer } from "./index";

type Call = [name: string, ...args: unknown[]];

function createMockGL2(overrides: Record<string, unknown> = {}) {
  const calls: Call[] = [];
  let uniformBufferBinding: unknown = null;

  const gl = {
    calls,
    UNIFORM_BUFFER: 0x8a11,
    UNIFORM_BUFFER_BINDING: 0x8a28,
    DYNAMIC_DRAW: 0x88e8,
    STATIC_DRAW: 0x88e4,
    INVALID_INDEX: 0xffffffff,
    texStorage2D: () => undefined,
    createFramebuffer: () => ({ tag: "framebuffer" }),
    bindFramebuffer: () => undefined,
    checkFramebufferStatus: () => 0x8cd5,
    createBuffer: () => ({ tag: "buffer" }),
    bindBuffer: (target: number, value: unknown) => {
      if (target === gl.UNIFORM_BUFFER) uniformBufferBinding = value;
      calls.push(["bindBuffer", target, value]);
    },
    bufferData: (...args: unknown[]) => calls.push(["bufferData", ...args]),
    bufferSubData: (...args: unknown[]) => calls.push(["bufferSubData", ...args]),
    bindBufferBase: (...args: unknown[]) => calls.push(["bindBufferBase", ...args]),
    bindBufferRange: (...args: unknown[]) => calls.push(["bindBufferRange", ...args]),
    getUniformBlockIndex: (...args: unknown[]) => {
      calls.push(["getUniformBlockIndex", ...args]);
      return 3;
    },
    uniformBlockBinding: (...args: unknown[]) => calls.push(["uniformBlockBinding", ...args]),
    deleteBuffer: (...args: unknown[]) => calls.push(["deleteBuffer", ...args]),
    getParameter: (parameter: number) => {
      if (parameter === gl.UNIFORM_BUFFER_BINDING) return uniformBufferBinding;
      return null;
    },
    ...overrides
  } as unknown as WebGL2RenderingContext & { calls: Call[] };

  return gl;
}

function createMockGL1() {
  const gl = createMockGL2();
  return { ...gl, texStorage2D: undefined } as unknown as WebGLRenderingContext;
}

describe("UniformBuffer", () => {
  it("requires a WebGL2 context", () => {
    expect(() => new UniformBuffer(createMockGL1(), { data: 64 })).toThrow(
      "UniformBuffer requires a WebGL2 context."
    );
  });

  it("allocates byte-sized storage with DYNAMIC_DRAW by default", () => {
    const gl = createMockGL2();
    const ubo = new UniformBuffer(gl, { data: 64 });

    expect(ubo.byteLength).toBe(64);
    expect(gl.calls).toContainEqual(["bufferData", gl.UNIFORM_BUFFER, 64, gl.DYNAMIC_DRAW]);
  });

  it("uploads initial data and restores the previous UNIFORM_BUFFER binding", () => {
    const gl = createMockGL2();
    const previous = { tag: "previous" };
    gl.bindBuffer(gl.UNIFORM_BUFFER, previous as unknown as WebGLBuffer);

    const data = new Float32Array([1, 2, 3, 4]);
    const ubo = new UniformBuffer(gl, { data, usage: gl.STATIC_DRAW });

    expect(ubo.byteLength).toBe(16);
    expect(gl.calls).toContainEqual(["bufferData", gl.UNIFORM_BUFFER, data, gl.STATIC_DRAW]);
    expect(gl.calls.at(-1)).toEqual(["bindBuffer", gl.UNIFORM_BUFFER, previous]);
  });

  it("update writes at a byte offset and restores the previous binding", () => {
    const gl = createMockGL2();
    const ubo = new UniformBuffer(gl, { data: 64 });

    const patch = new Float32Array([5, 6]);
    ubo.update(patch, 16);

    expect(gl.calls).toContainEqual(["bufferSubData", gl.UNIFORM_BUFFER, 16, patch]);
    expect(gl.calls.at(-1)).toEqual(["bindBuffer", gl.UNIFORM_BUFFER, null]);
  });

  it("update rejects writes past the allocated size", () => {
    const gl = createMockGL2();
    const ubo = new UniformBuffer(gl, { data: 16 });

    expect(() => ubo.update(new Float32Array([1, 2, 3, 4]), 8)).toThrow(
      "Update of 16 bytes at offset 8 exceeds the buffer's 16 bytes."
    );
  });

  it("bindTo binds the buffer to an indexed binding point", () => {
    const gl = createMockGL2();
    const ubo = new UniformBuffer(gl, { data: 32 });

    ubo.bindTo(2);
    expect(gl.calls).toContainEqual(["bindBufferBase", gl.UNIFORM_BUFFER, 2, ubo.buffer]);
  });

  it("bindRange binds a slice of the buffer to a binding point", () => {
    const gl = createMockGL2();
    const ubo = new UniformBuffer(gl, { data: 256 });

    ubo.bindRange(1, 64, 128);
    expect(gl.calls).toContainEqual(["bindBufferRange", gl.UNIFORM_BUFFER, 1, ubo.buffer, 64, 128]);
  });

  it("connect maps a named uniform block to a binding point", () => {
    const gl = createMockGL2();
    const ubo = new UniformBuffer(gl, { data: 32 });
    const program = { tag: "program" } as unknown as WebGLProgram;

    const result = ubo.connect({ program }, "Lights", 2);

    expect(result).toBe(ubo);
    expect(gl.calls).toContainEqual(["getUniformBlockIndex", program, "Lights"]);
    expect(gl.calls).toContainEqual(["uniformBlockBinding", program, 3, 2]);
  });

  it("connect throws when the uniform block is missing", () => {
    const gl = createMockGL2({
      getUniformBlockIndex: () => 0xffffffff
    });
    const ubo = new UniformBuffer(gl, { data: 32 });

    expect(() => ubo.connect({ tag: "program" } as unknown as WebGLProgram, "Missing", 0)).toThrow(
      'Uniform block "Missing" was not found.'
    );
  });

  it("rejects use after dispose and disposes idempotently", () => {
    const gl = createMockGL2();
    const ubo = new UniformBuffer(gl, { data: 16 });

    ubo.dispose();
    ubo.dispose();

    expect(ubo.disposed).toBe(true);
    expect(() => ubo.bindTo(0)).toThrow("UniformBuffer has been disposed.");
    const deletions = gl.calls.filter(([name]) => name === "deleteBuffer");
    expect(deletions).toEqual([["deleteBuffer", ubo.buffer]]);
  });
});
