import { describe, expect, it } from "vitest";
import { GLBuffer } from "./index";

type Call = [name: string, ...args: unknown[]];

function createMockGL(overrides: Record<string, unknown> = {}) {
  const calls: Call[] = [];
  const buffer = { type: "buffer" };
  let arrayBufferBinding: unknown = null;
  let elementArrayBufferBinding: unknown = null;

  const gl = {
    calls,
    ARRAY_BUFFER: 0x8892,
    ELEMENT_ARRAY_BUFFER: 0x8893,
    ARRAY_BUFFER_BINDING: 0x8894,
    ELEMENT_ARRAY_BUFFER_BINDING: 0x8895,
    STATIC_DRAW: 0x88e4,
    createFramebuffer: () => ({}),
    bindFramebuffer: () => undefined,
    checkFramebufferStatus: () => 0x8cd5,
    createBuffer: () => buffer,
    bindBuffer: (target: number, value: unknown) => {
      if (target === gl.ARRAY_BUFFER) {
        arrayBufferBinding = value;
      }

      if (target === gl.ELEMENT_ARRAY_BUFFER) {
        elementArrayBufferBinding = value;
      }

      calls.push(["bindBuffer", target, value]);
    },
    bufferData: (...args: unknown[]) => calls.push(["bufferData", ...args]),
    bufferSubData: (...args: unknown[]) => calls.push(["bufferSubData", ...args]),
    getParameter: (parameter: number) => {
      if (parameter === gl.ARRAY_BUFFER_BINDING) {
        return arrayBufferBinding;
      }

      if (parameter === gl.ELEMENT_ARRAY_BUFFER_BINDING) {
        return elementArrayBufferBinding;
      }

      return null;
    },
    deleteBuffer: (...args: unknown[]) => calls.push(["deleteBuffer", ...args]),
    ...overrides
  } as unknown as WebGLRenderingContext & { calls: Call[] };

  return gl;
}

describe("GLBuffer", () => {
  it("rejects a non-WebGL rendering context", () => {
    expect(() => new GLBuffer({} as unknown as WebGLRenderingContext, { target: 0x8892 })).toThrow(
      "gl must be a WebGL rendering context."
    );
  });

  it("uploads typed-array data and tracks byte length", () => {
    const gl = createMockGL();
    const data = new Float32Array([0, 1, 2, 3]);
    const buffer = new GLBuffer(gl, {
      target: gl.ARRAY_BUFFER,
      data,
      usage: gl.STATIC_DRAW
    });

    expect(buffer.byteLength).toBe(data.byteLength);
    expect(gl.calls.some(([name]) => name === "bufferData")).toBe(true);
  });

  it("allocates storage from a numeric size and tracks byte length", () => {
    const gl = createMockGL();
    const buffer = new GLBuffer(gl, { target: gl.ARRAY_BUFFER });

    buffer.upload(1024);

    expect(buffer.byteLength).toBe(1024);
    expect(gl.calls).toContainEqual(["bufferData", gl.ARRAY_BUFFER, 1024, gl.STATIC_DRAW]);
  });

  it("restores previous buffer binding after upload", () => {
    const gl = createMockGL();
    const previousBuffer = { type: "previous-buffer" };
    gl.bindBuffer(gl.ARRAY_BUFFER, previousBuffer);

    new GLBuffer(gl, {
      target: gl.ARRAY_BUFFER,
      data: new Float32Array([0, 1]),
      usage: gl.STATIC_DRAW
    });

    expect(gl.getParameter(gl.ARRAY_BUFFER_BINDING)).toBe(previousBuffer);
  });

  it("binds within withBound and restores the previous buffer binding", () => {
    const gl = createMockGL();
    const previous = { type: "previous-buffer" };
    gl.bindBuffer(gl.ARRAY_BUFFER, previous);
    const buffer = new GLBuffer(gl, { target: gl.ARRAY_BUFFER });

    let boundDuringCallback: unknown;
    const result = buffer.withBound(() => {
      boundDuringCallback = gl.getParameter(gl.ARRAY_BUFFER_BINDING);
      return "done";
    });

    expect(boundDuringCallback).toBe(buffer.buffer);
    expect(result).toBe("done");
    expect(gl.getParameter(gl.ARRAY_BUFFER_BINDING)).toBe(previous);
  });

  it("restores the previous buffer binding when withBound throws", () => {
    const gl = createMockGL();
    const previous = { type: "previous-buffer" };
    gl.bindBuffer(gl.ARRAY_BUFFER, previous);
    const buffer = new GLBuffer(gl, { target: gl.ARRAY_BUFFER });

    expect(() =>
      buffer.withBound(() => {
        throw new Error("boom");
      })
    ).toThrow("boom");
    expect(gl.getParameter(gl.ARRAY_BUFFER_BINDING)).toBe(previous);
  });

  it("updates a byte range with bufferSubData and restores the previous binding", () => {
    const gl = createMockGL();
    const buffer = new GLBuffer(gl, {
      target: gl.ARRAY_BUFFER,
      data: new Float32Array([0, 0, 0, 0])
    });
    const previous = { type: "previous-buffer" };
    gl.bindBuffer(gl.ARRAY_BUFFER, previous);
    const patch = new Float32Array([1, 2]);

    buffer.updateSubData(8, patch);

    expect(gl.calls).toContainEqual(["bufferSubData", gl.ARRAY_BUFFER, 8, patch]);
    expect(gl.getParameter(gl.ARRAY_BUFFER_BINDING)).toBe(previous);
  });

  it("throws when a sub-data update exceeds the buffer length", () => {
    const gl = createMockGL();
    const buffer = new GLBuffer(gl, { target: gl.ARRAY_BUFFER, data: new Float32Array([0, 0]) });

    expect(() => buffer.updateSubData(4, new Float32Array([1, 2]))).toThrow(RangeError);
  });

  it("rejects a negative sub-data offset", () => {
    const gl = createMockGL();
    const buffer = new GLBuffer(gl, { target: gl.ARRAY_BUFFER, data: new Float32Array([0, 0]) });

    expect(() => buffer.updateSubData(-4, new Float32Array([1]))).toThrow(RangeError);
  });

  it("rejects sub-data updates after disposal", () => {
    const gl = createMockGL();
    const buffer = new GLBuffer(gl, { target: gl.ARRAY_BUFFER, data: new Float32Array([0]) });

    buffer.dispose();

    expect(() => buffer.updateSubData(0, new Float32Array([1]))).toThrow(
      "GLBuffer has been disposed."
    );
  });

  it("deletes the buffer when the initial upload fails", () => {
    const gl = createMockGL({
      bufferData: () => {
        throw new Error("upload failed");
      }
    });

    expect(
      () => new GLBuffer(gl, { target: gl.ARRAY_BUFFER, data: new Float32Array([1]) })
    ).toThrow("upload failed");
    expect(gl.calls.filter(([name]) => name === "deleteBuffer")).toHaveLength(1);
  });

  it("disposes once and rejects upload after disposal", () => {
    const gl = createMockGL();
    const buffer = new GLBuffer(gl, { target: gl.ARRAY_BUFFER });

    buffer.dispose();
    buffer.dispose();

    expect(buffer.disposed).toBe(true);
    expect(gl.calls.filter(([name]) => name === "deleteBuffer")).toHaveLength(1);
    expect(() => buffer.upload(new Float32Array([1]))).toThrow("GLBuffer has been disposed.");
  });
});
