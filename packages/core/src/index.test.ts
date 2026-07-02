import { describe, expect, it } from "vitest";
import {
  DisposedResourceError,
  WebGLError,
  assertNotDisposed,
  assertPositiveIntegerDimension,
  getFramebufferStatusMessage,
  isWebGL2,
  isWebGLContext
} from "./index";

function createMockGL(overrides: Record<string, unknown> = {}): WebGLRenderingContext {
  return {
    FRAMEBUFFER_COMPLETE: 0x8cd5,
    FRAMEBUFFER_INCOMPLETE_ATTACHMENT: 0x8cd6,
    FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT: 0x8cd7,
    FRAMEBUFFER_INCOMPLETE_DIMENSIONS: 0x8cd9,
    FRAMEBUFFER_UNSUPPORTED: 0x8cdd,
    createFramebuffer: () => ({}),
    bindFramebuffer: () => undefined,
    checkFramebufferStatus: () => 0x8cd5,
    ...overrides
  } as unknown as WebGLRenderingContext;
}

describe("core WebGL helpers", () => {
  it("recognizes a WebGL-like rendering context", () => {
    expect(isWebGLContext(createMockGL())).toBe(true);
    expect(isWebGLContext({})).toBe(false);
    expect(isWebGLContext(null)).toBe(false);
  });

  it("detects WebGL2 contexts by texStorage2D support", () => {
    expect(isWebGL2(createMockGL())).toBe(false);
    expect(isWebGL2(createMockGL({ texStorage2D: () => undefined }))).toBe(true);
  });

  it("validates positive integer dimensions", () => {
    expect(assertPositiveIntegerDimension("width", 512)).toBe(512);
    expect(() => assertPositiveIntegerDimension("height", 0)).toThrow(RangeError);
    expect(() => assertPositiveIntegerDimension("width", 1.5)).toThrow(TypeError);
  });

  it("throws a typed error for disposed resources", () => {
    expect(() => assertNotDisposed("Framebuffer", true)).toThrow(DisposedResourceError);
    expect(() => assertNotDisposed("Framebuffer", false)).not.toThrow();
  });

  it("maps known framebuffer status values", () => {
    const gl = createMockGL();
    expect(getFramebufferStatusMessage(gl, gl.FRAMEBUFFER_COMPLETE)).toContain("complete");
    expect(getFramebufferStatusMessage(gl, gl.FRAMEBUFFER_UNSUPPORTED)).toContain("unsupported");
    expect(getFramebufferStatusMessage(gl, 12345)).toContain("Unknown");
  });

  it("exposes a base WebGL error type", () => {
    expect(new WebGLError("failed")).toBeInstanceOf(Error);
  });
});
