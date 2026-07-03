import { describe, expect, it } from "vitest";
import { FBO, Framebuffer } from "./index";

type Call = [name: string, ...args: unknown[]];

function createMockGL(overrides: Record<string, unknown> = {}) {
  const calls: Call[] = [];
  const framebuffer = { type: "framebuffer" };
  const texture = { type: "texture" };
  const renderbuffer = { type: "renderbuffer" };

  const gl = {
    calls,
    FRAMEBUFFER: 0x8d40,
    RENDERBUFFER: 0x8d41,
    TEXTURE_2D: 0x0de1,
    COLOR_ATTACHMENT0: 0x8ce0,
    DEPTH_ATTACHMENT: 0x8d00,
    DEPTH_STENCIL_ATTACHMENT: 0x821a,
    DEPTH_COMPONENT16: 0x81a5,
    DEPTH_STENCIL: 0x84f9,
    RGBA: 0x1908,
    UNSIGNED_BYTE: 0x1401,
    LINEAR: 0x2601,
    CLAMP_TO_EDGE: 0x812f,
    FRAMEBUFFER_COMPLETE: 0x8cd5,
    FRAMEBUFFER_INCOMPLETE_ATTACHMENT: 0x8cd6,
    FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT: 0x8cd7,
    FRAMEBUFFER_INCOMPLETE_DIMENSIONS: 0x8cd9,
    FRAMEBUFFER_UNSUPPORTED: 0x8cdd,
    TEXTURE_MIN_FILTER: 0x2801,
    TEXTURE_MAG_FILTER: 0x2800,
    TEXTURE_WRAP_S: 0x2802,
    TEXTURE_WRAP_T: 0x2803,
    createFramebuffer: () => framebuffer,
    createTexture: () => texture,
    createRenderbuffer: () => renderbuffer,
    bindFramebuffer: (...args: unknown[]) => calls.push(["bindFramebuffer", ...args]),
    bindTexture: (...args: unknown[]) => calls.push(["bindTexture", ...args]),
    bindRenderbuffer: (...args: unknown[]) => calls.push(["bindRenderbuffer", ...args]),
    texParameteri: (...args: unknown[]) => calls.push(["texParameteri", ...args]),
    texImage2D: (...args: unknown[]) => calls.push(["texImage2D", ...args]),
    framebufferTexture2D: (...args: unknown[]) => calls.push(["framebufferTexture2D", ...args]),
    renderbufferStorage: (...args: unknown[]) => calls.push(["renderbufferStorage", ...args]),
    framebufferRenderbuffer: (...args: unknown[]) =>
      calls.push(["framebufferRenderbuffer", ...args]),
    checkFramebufferStatus: () => 0x8cd5,
    readPixels: (...args: unknown[]) => calls.push(["readPixels", ...args]),
    deleteFramebuffer: (...args: unknown[]) => calls.push(["deleteFramebuffer", ...args]),
    deleteTexture: (...args: unknown[]) => calls.push(["deleteTexture", ...args]),
    deleteRenderbuffer: (...args: unknown[]) => calls.push(["deleteRenderbuffer", ...args]),
    ...overrides
  } as unknown as WebGLRenderingContext & { calls: Call[] };

  return gl;
}

describe("Framebuffer", () => {
  it("exports FBO as a compatibility alias", () => {
    expect(FBO).toBe(Framebuffer);
  });

  it("creates a color framebuffer target", () => {
    const gl = createMockGL();
    const framebuffer = new Framebuffer(gl, { width: 64, height: 32 });

    expect(framebuffer.width).toBe(64);
    expect(framebuffer.height).toBe(32);
    expect(framebuffer.disposed).toBe(false);
    expect(framebuffer.framebuffer).toBeTruthy();
    expect(framebuffer.texture).toBeTruthy();
    expect(framebuffer.renderbuffer).toBeNull();
    expect(gl.calls.some(([name]) => name === "framebufferTexture2D")).toBe(true);
  });

  it("creates an optional depth renderbuffer", () => {
    const gl = createMockGL();
    const framebuffer = new Framebuffer(gl, { width: 16, height: 16, depth: true });

    expect(framebuffer.renderbuffer).toBeTruthy();
    expect(gl.calls.some(([name]) => name === "renderbufferStorage")).toBe(true);
  });

  it("creates an optional depth-stencil renderbuffer", () => {
    const gl = createMockGL();
    const framebuffer = new Framebuffer(gl, { width: 16, height: 16, stencil: true });

    expect(framebuffer.renderbuffer).toBeTruthy();
    expect(
      gl.calls.some(
        ([name, , attachment]) =>
          name === "framebufferRenderbuffer" && attachment === gl.DEPTH_STENCIL_ATTACHMENT
      )
    ).toBe(true);
  });

  it("rejects invalid dimensions", () => {
    const gl = createMockGL();
    expect(() => new Framebuffer(gl, { width: 0, height: 16 })).toThrow(RangeError);
    expect(() => new Framebuffer(gl, { width: 16.5, height: 16 })).toThrow(TypeError);
  });

  it("throws a descriptive error when framebuffer completeness fails", () => {
    const gl = createMockGL({
      checkFramebufferStatus: () => 0x8cd6
    });

    expect(() => new Framebuffer(gl, { width: 16, height: 16 })).toThrow("incomplete attachment");
  });

  it("binds and unbinds the framebuffer", () => {
    const gl = createMockGL();
    const framebuffer = new Framebuffer(gl, { width: 16, height: 16 });

    framebuffer.bind();
    framebuffer.unbind();

    const bindCalls = gl.calls.filter(([name]) => name === "bindFramebuffer");
    expect(bindCalls.at(-2)).toEqual(["bindFramebuffer", gl.FRAMEBUFFER, framebuffer.framebuffer]);
    expect(bindCalls.at(-1)).toEqual(["bindFramebuffer", gl.FRAMEBUFFER, null]);
  });

  it("scopes rendering work with withBound", () => {
    const gl = createMockGL();
    const framebuffer = new Framebuffer(gl, { width: 16, height: 16 });

    const result = framebuffer.withBound(() => "rendered");

    expect(result).toBe("rendered");
    const bindCalls = gl.calls.filter(([name]) => name === "bindFramebuffer");
    expect(bindCalls.at(-2)).toEqual(["bindFramebuffer", gl.FRAMEBUFFER, framebuffer.framebuffer]);
    expect(bindCalls.at(-1)).toEqual(["bindFramebuffer", gl.FRAMEBUFFER, null]);
  });

  it("unbinds even when withBound throws", () => {
    const gl = createMockGL();
    const framebuffer = new Framebuffer(gl, { width: 16, height: 16 });

    expect(() =>
      framebuffer.withBound(() => {
        throw new Error("render failed");
      })
    ).toThrow("render failed");

    const bindCalls = gl.calls.filter(([name]) => name === "bindFramebuffer");
    expect(bindCalls.at(-2)).toEqual(["bindFramebuffer", gl.FRAMEBUFFER, framebuffer.framebuffer]);
    expect(bindCalls.at(-1)).toEqual(["bindFramebuffer", gl.FRAMEBUFFER, null]);
  });

  it("resizes texture storage without replacing the framebuffer object", () => {
    const gl = createMockGL();
    const framebuffer = new Framebuffer(gl, { width: 16, height: 16, depth: true });
    const originalFramebuffer = framebuffer.framebuffer;

    framebuffer.resize({ width: 32, height: 24 });

    expect(framebuffer.framebuffer).toBe(originalFramebuffer);
    expect(framebuffer.width).toBe(32);
    expect(framebuffer.height).toBe(24);
    expect(gl.calls.filter(([name]) => name === "texImage2D")).toHaveLength(2);
    expect(gl.calls.filter(([name]) => name === "renderbufferStorage")).toHaveLength(2);
  });

  it("resizes from canvas dimensions", () => {
    const gl = createMockGL();
    const framebuffer = new Framebuffer(gl, { width: 16, height: 16 });

    framebuffer.resizeToCanvas({ width: 80, height: 40 });

    expect(framebuffer.width).toBe(80);
    expect(framebuffer.height).toBe(40);
  });

  it("reads RGBA unsigned byte pixels", () => {
    const gl = createMockGL();
    const framebuffer = new Framebuffer(gl, { width: 2, height: 2 });

    const pixels = framebuffer.readPixels();

    expect(pixels).toBeInstanceOf(Uint8Array);
    expect(pixels).toHaveLength(16);
    expect(gl.calls.some(([name]) => name === "readPixels")).toBe(true);
  });

  it("disposes GPU resources once", () => {
    const gl = createMockGL();
    const framebuffer = new Framebuffer(gl, { width: 16, height: 16, depth: true });

    framebuffer.dispose();
    framebuffer.dispose();

    expect(framebuffer.disposed).toBe(true);
    expect(gl.calls.filter(([name]) => name === "deleteFramebuffer")).toHaveLength(1);
    expect(gl.calls.filter(([name]) => name === "deleteTexture")).toHaveLength(1);
    expect(gl.calls.filter(([name]) => name === "deleteRenderbuffer")).toHaveLength(1);
  });

  it("throws when used after disposal", () => {
    const gl = createMockGL();
    const framebuffer = new Framebuffer(gl, { width: 16, height: 16 });

    framebuffer.dispose();

    expect(() => framebuffer.bind()).toThrow("Framebuffer has been disposed.");
    expect(() => framebuffer.resize({ width: 32, height: 32 })).toThrow(
      "Framebuffer has been disposed."
    );
    expect(() => framebuffer.readPixels()).toThrow("Framebuffer has been disposed.");
  });
});
