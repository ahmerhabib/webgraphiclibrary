import { describe, expect, it } from "vitest";
import { MultiTarget } from "./index";

type Call = [name: string, ...args: unknown[]];

function createMockGL2(overrides: Record<string, unknown> = {}) {
  const calls: Call[] = [];
  let framebufferBinding: unknown = null;
  let textureBinding: unknown = null;
  let renderbufferBinding: unknown = null;

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
    FLOAT: 0x1406,
    LINEAR: 0x2601,
    NEAREST: 0x2600,
    CLAMP_TO_EDGE: 0x812f,
    TEXTURE_MIN_FILTER: 0x2801,
    TEXTURE_MAG_FILTER: 0x2800,
    TEXTURE_WRAP_S: 0x2802,
    TEXTURE_WRAP_T: 0x2803,
    FRAMEBUFFER_COMPLETE: 0x8cd5,
    FRAMEBUFFER_BINDING: 0x8ca6,
    TEXTURE_BINDING_2D: 0x8069,
    RENDERBUFFER_BINDING: 0x8ca7,
    MAX_COLOR_ATTACHMENTS: 0x8cdf,
    texStorage2D: () => undefined,
    createFramebuffer: () => ({ tag: "framebuffer" }),
    createTexture: () => ({ tag: "texture" }),
    createRenderbuffer: () => ({ tag: "renderbuffer" }),
    bindFramebuffer: (target: number, value: unknown) => {
      if (target === gl.FRAMEBUFFER) framebufferBinding = value;
      calls.push(["bindFramebuffer", target, value]);
    },
    bindTexture: (target: number, value: unknown) => {
      if (target === gl.TEXTURE_2D) textureBinding = value;
      calls.push(["bindTexture", target, value]);
    },
    bindRenderbuffer: (target: number, value: unknown) => {
      if (target === gl.RENDERBUFFER) renderbufferBinding = value;
      calls.push(["bindRenderbuffer", target, value]);
    },
    texParameteri: (...args: unknown[]) => calls.push(["texParameteri", ...args]),
    texImage2D: (...args: unknown[]) => calls.push(["texImage2D", ...args]),
    framebufferTexture2D: (...args: unknown[]) => calls.push(["framebufferTexture2D", ...args]),
    renderbufferStorage: (...args: unknown[]) => calls.push(["renderbufferStorage", ...args]),
    framebufferRenderbuffer: (...args: unknown[]) =>
      calls.push(["framebufferRenderbuffer", ...args]),
    drawBuffers: (...args: unknown[]) => calls.push(["drawBuffers", ...args]),
    readBuffer: (...args: unknown[]) => calls.push(["readBuffer", ...args]),
    readPixels: (...args: unknown[]) => calls.push(["readPixels", ...args]),
    checkFramebufferStatus: () => 0x8cd5,
    getParameter: (parameter: number) => {
      if (parameter === gl.FRAMEBUFFER_BINDING) return framebufferBinding;
      if (parameter === gl.TEXTURE_BINDING_2D) return textureBinding;
      if (parameter === gl.RENDERBUFFER_BINDING) return renderbufferBinding;
      if (parameter === gl.MAX_COLOR_ATTACHMENTS) return 8;
      return null;
    },
    deleteFramebuffer: (...args: unknown[]) => calls.push(["deleteFramebuffer", ...args]),
    deleteTexture: (...args: unknown[]) => calls.push(["deleteTexture", ...args]),
    deleteRenderbuffer: (...args: unknown[]) => calls.push(["deleteRenderbuffer", ...args]),
    ...overrides
  } as unknown as WebGL2RenderingContext & { calls: Call[] };

  return gl;
}

function createMockGL1() {
  const gl = createMockGL2();
  // Remove the WebGL2 marker so isWebGL2 reports false.
  return { ...gl, texStorage2D: undefined } as unknown as WebGLRenderingContext;
}

describe("MultiTarget", () => {
  it("requires a WebGL2 context", () => {
    expect(() => new MultiTarget(createMockGL1(), { width: 4, height: 4 })).toThrow(
      "MultiTarget requires a WebGL2 context."
    );
  });

  it("creates one texture per color attachment and calls drawBuffers", () => {
    const gl = createMockGL2();
    const target = new MultiTarget(gl, { width: 8, height: 8, attachments: 3 });

    expect(target.textures).toHaveLength(3);
    expect(target.texture).toBe(target.textures[0]);
    expect(gl.calls).toContainEqual([
      "framebufferTexture2D",
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0 + 2,
      gl.TEXTURE_2D,
      target.textures[2],
      0
    ]);
    expect(gl.calls).toContainEqual([
      "drawBuffers",
      [gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT0 + 1, gl.COLOR_ATTACHMENT0 + 2]
    ]);
  });

  it("defaults to two attachments", () => {
    const gl = createMockGL2();
    const target = new MultiTarget(gl, { width: 4, height: 4 });
    expect(target.textures).toHaveLength(2);
  });

  it("rejects more attachments than the context supports", () => {
    const gl = createMockGL2({ getParameter: () => 2 });
    expect(() => new MultiTarget(gl, { width: 4, height: 4, attachments: 4 })).toThrow("supports");
  });

  it("applies per-attachment format specs", () => {
    const gl = createMockGL2();
    new MultiTarget(gl, {
      width: 2,
      height: 2,
      attachments: [{ type: gl.UNSIGNED_BYTE }, { internalFormat: 0x8814, type: gl.FLOAT }]
    });

    const texImageCalls = gl.calls.filter(([name]) => name === "texImage2D");
    expect(texImageCalls[1]).toEqual([
      "texImage2D",
      gl.TEXTURE_2D,
      0,
      0x8814,
      2,
      2,
      0,
      gl.RGBA,
      gl.FLOAT,
      null
    ]);
  });

  it("creates a depth renderbuffer when requested", () => {
    const gl = createMockGL2();
    const target = new MultiTarget(gl, { width: 4, height: 4, depth: true });

    expect(target.renderbuffer).not.toBeNull();
    expect(gl.calls.some(([name]) => name === "renderbufferStorage")).toBe(true);
  });

  it("reads a chosen attachment and restores the previous framebuffer binding", () => {
    const gl = createMockGL2();
    const target = new MultiTarget(gl, { width: 2, height: 2, attachments: 2 });
    const out = new Uint8Array(2 * 2 * 4);

    const result = target.readPixelsInto(out, 1);

    expect(result).toBe(out);
    expect(gl.calls).toContainEqual(["readBuffer", gl.COLOR_ATTACHMENT0 + 1]);
    expect(gl.calls).toContainEqual(["readPixels", 0, 0, 2, 2, gl.RGBA, gl.UNSIGNED_BYTE, out]);
    expect(gl.getParameter(gl.FRAMEBUFFER_BINDING)).toBeNull();
  });

  it("resizes every attachment texture", () => {
    const gl = createMockGL2();
    const target = new MultiTarget(gl, { width: 4, height: 4, attachments: 2 });
    const before = gl.calls.filter(([name]) => name === "texImage2D").length;

    target.resize({ width: 8, height: 8 });

    const after = gl.calls.filter(([name]) => name === "texImage2D").length;
    expect(after - before).toBe(2);
    expect(target.width).toBe(8);
  });

  it("disposes the framebuffer, all textures, and the renderbuffer once", () => {
    const gl = createMockGL2();
    const target = new MultiTarget(gl, { width: 4, height: 4, attachments: 3, depth: true });

    target.dispose();
    target.dispose();

    expect(target.disposed).toBe(true);
    expect(gl.calls.filter(([name]) => name === "deleteFramebuffer")).toHaveLength(1);
    expect(gl.calls.filter(([name]) => name === "deleteTexture")).toHaveLength(3);
    expect(gl.calls.filter(([name]) => name === "deleteRenderbuffer")).toHaveLength(1);
  });
});
