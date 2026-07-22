import { describe, expect, it } from "vitest";
import { VertexArray } from "./index";

type Call = [name: string, ...args: unknown[]];

function createMockGL2(overrides: Record<string, unknown> = {}) {
  const calls: Call[] = [];
  let vertexArrayBinding: unknown = null;

  const gl = {
    calls,
    VERTEX_ARRAY_BINDING: 0x85b5,
    texStorage2D: () => undefined,
    createFramebuffer: () => ({ tag: "framebuffer" }),
    bindFramebuffer: () => undefined,
    checkFramebufferStatus: () => 0x8cd5,
    createVertexArray: () => ({ tag: "vertexArray" }),
    bindVertexArray: (value: unknown) => {
      vertexArrayBinding = value;
      calls.push(["bindVertexArray", value]);
    },
    deleteVertexArray: (...args: unknown[]) => calls.push(["deleteVertexArray", ...args]),
    getParameter: (parameter: number) => {
      if (parameter === gl.VERTEX_ARRAY_BINDING) return vertexArrayBinding;
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

describe("VertexArray", () => {
  it("rejects a non-context", () => {
    expect(() => new VertexArray({} as WebGLRenderingContext)).toThrow(
      "gl must be a WebGL rendering context."
    );
  });

  it("requires a WebGL2 context", () => {
    expect(() => new VertexArray(createMockGL1())).toThrow(
      "VertexArray requires a WebGL2 context."
    );
  });

  it("throws when the vertex array cannot be created", () => {
    const gl = createMockGL2({ createVertexArray: () => null });
    expect(() => new VertexArray(gl)).toThrow("Failed to create vertex array.");
  });

  it("binds and unbinds the vertex array", () => {
    const gl = createMockGL2();
    const vao = new VertexArray(gl);

    vao.bind();
    expect(gl.calls).toContainEqual(["bindVertexArray", vao.vertexArray]);

    vao.unbind();
    expect(gl.calls.at(-1)).toEqual(["bindVertexArray", null]);
  });

  it("withBound restores the previously bound vertex array and returns the result", () => {
    const gl = createMockGL2();
    const previous = { tag: "previous" };
    gl.bindVertexArray(previous as unknown as WebGLVertexArrayObject);

    const vao = new VertexArray(gl);
    const result = vao.withBound(() => {
      expect(gl.calls.at(-1)).toEqual(["bindVertexArray", vao.vertexArray]);
      return "rendered";
    });

    expect(result).toBe("rendered");
    expect(gl.calls.at(-1)).toEqual(["bindVertexArray", previous]);
  });

  it("withBound restores the previous binding when the callback throws", () => {
    const gl = createMockGL2();
    const previous = { tag: "previous" };
    gl.bindVertexArray(previous as unknown as WebGLVertexArrayObject);

    const vao = new VertexArray(gl);
    expect(() =>
      vao.withBound(() => {
        throw new Error("render failed");
      })
    ).toThrow("render failed");
    expect(gl.calls.at(-1)).toEqual(["bindVertexArray", previous]);
  });

  it("rejects use after dispose", () => {
    const gl = createMockGL2();
    const vao = new VertexArray(gl);
    vao.dispose();

    expect(vao.disposed).toBe(true);
    expect(() => vao.bind()).toThrow("VertexArray has been disposed.");
  });

  it("dispose deletes the vertex array and is idempotent", () => {
    const gl = createMockGL2();
    const vao = new VertexArray(gl);

    vao.dispose();
    vao.dispose();

    const deletions = gl.calls.filter(([name]) => name === "deleteVertexArray");
    expect(deletions).toEqual([["deleteVertexArray", vao.vertexArray]]);
  });
});
