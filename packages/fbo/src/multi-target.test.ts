import { describe, expect, it } from "vitest";
import { MultiTarget } from "./index";

type Call = [name: string, ...args: unknown[]];

function createMockGL2(overrides: Record<string, unknown> = {}) {
  const calls: Call[] = [];
  let framebufferBinding: unknown = null;
  let textureBinding: unknown = null;
  let renderbufferBinding: unknown = null;

  let readFramebufferBinding: unknown = null;

  const gl = {
    calls,
    FRAMEBUFFER: 0x8d40,
    READ_FRAMEBUFFER: 0x8ca8,
    READ_FRAMEBUFFER_BINDING: 0x8caa,
    RGBA16F: 0x881a,
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
      // Per the WebGL2 spec, FRAMEBUFFER sets both binding points.
      if (target === gl.FRAMEBUFFER) {
        framebufferBinding = value;
        readFramebufferBinding = value;
      }
      if (target === gl.READ_FRAMEBUFFER) readFramebufferBinding = value;
      calls.push(["bindFramebuffer", target, value]);
    },
    getExtension: (name: string) => {
      calls.push(["getExtension", name]);
      return {};
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
      if (parameter === gl.READ_FRAMEBUFFER_BINDING) return readFramebufferBinding;
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

  it("binds, unbinds, and restores the previous framebuffer in withBound", () => {
    const gl = createMockGL2();
    const previous = { type: "previous-framebuffer" };
    const target = new MultiTarget(gl, { width: 4, height: 4 });
    gl.bindFramebuffer(gl.FRAMEBUFFER, previous);

    let boundDuring: unknown;
    const result = target.withBound(() => {
      boundDuring = gl.getParameter(gl.FRAMEBUFFER_BINDING);
      return "ok";
    });

    expect(boundDuring).toBe(target.framebuffer);
    expect(result).toBe("ok");
    expect(gl.getParameter(gl.FRAMEBUFFER_BINDING)).toBe(previous);

    target.bind();
    expect(gl.getParameter(gl.FRAMEBUFFER_BINDING)).toBe(target.framebuffer);
    target.unbind();
    expect(gl.getParameter(gl.FRAMEBUFFER_BINDING)).toBeNull();
  });

  it("readPixels allocates a correctly sized array and resizeToCanvas resizes", () => {
    const gl = createMockGL2();
    const target = new MultiTarget(gl, { width: 3, height: 2, attachments: 2 });

    expect(target.readPixels(1).length).toBe(3 * 2 * 4);

    target.resizeToCanvas({ width: 10, height: 6 });
    expect(target.width).toBe(10);
    expect(target.height).toBe(6);
  });

  it("rejects readback of a missing attachment, a too-small array, and a non-byte format", () => {
    const gl = createMockGL2();
    const two = new MultiTarget(gl, { width: 4, height: 4, attachments: 2 });
    expect(() => two.readPixelsInto(new Uint8Array(64), 5)).toThrow(RangeError);
    expect(() => two.readPixelsInto(new Uint8Array(4), 0)).toThrow(RangeError);

    const float = new MultiTarget(gl, { width: 2, height: 2, attachments: [{ type: gl.FLOAT }] });
    expect(() => float.readPixelsInto(new Uint8Array(16), 0)).toThrow("RGBA UNSIGNED_BYTE");
  });

  it("cleans up every texture and the framebuffer when the result is incomplete", () => {
    const gl = createMockGL2({ checkFramebufferStatus: () => 0x8cd6 });

    expect(() => new MultiTarget(gl, { width: 2, height: 2, attachments: 3 })).toThrow();
    expect(gl.calls.filter(([name]) => name === "deleteFramebuffer")).toHaveLength(1);
    expect(gl.calls.filter(([name]) => name === "deleteTexture")).toHaveLength(3);
  });

  it("requests EXT_color_buffer_float for float and half-float attachments", () => {
    const gl = createMockGL2();
    new MultiTarget(gl, { width: 2, height: 2, attachments: [{ type: gl.FLOAT }] });
    expect(gl.calls).toContainEqual(["getExtension", "EXT_color_buffer_float"]);

    const gl2 = createMockGL2();
    new MultiTarget(gl2, {
      width: 2,
      height: 2,
      attachments: [{ internalFormat: gl2.RGBA16F }]
    });
    expect(gl2.calls).toContainEqual(["getExtension", "EXT_color_buffer_float"]);

    const gl3 = createMockGL2();
    new MultiTarget(gl3, { width: 2, height: 2 });
    expect(gl3.calls.some(([name]) => name === "getExtension")).toBe(false);
  });

  it("restores the read framebuffer binding around withBound", () => {
    const gl = createMockGL2();
    const target = new MultiTarget(gl, { width: 2, height: 2 });
    const previousRead = { tag: "read-framebuffer" };
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, previousRead);

    target.withBound(() => undefined);

    expect(gl.getParameter(gl.READ_FRAMEBUFFER_BINDING)).toBe(previousRead);
  });

  it("reallocates storage at the previous size when a resize fails", () => {
    let fail = false;
    const gl = createMockGL2({
      checkFramebufferStatus: () => (fail ? 0x8cd6 : 0x8cd5)
    });
    const target = new MultiTarget(gl, { width: 4, height: 4, attachments: 2, depth: true });

    fail = true;
    expect(() => target.resize({ width: 8, height: 8 })).toThrow();

    expect(target.width).toBe(4);
    expect(target.height).toBe(4);
    const texImageCalls = gl.calls.filter(([name]) => name === "texImage2D");
    const lastTwo = texImageCalls.slice(-2);
    for (const call of lastTwo) {
      expect(call[4]).toBe(4);
      expect(call[5]).toBe(4);
    }
    const storageCalls = gl.calls.filter(([name]) => name === "renderbufferStorage");
    const lastStorage = storageCalls[storageCalls.length - 1] as unknown[];
    expect(lastStorage[3]).toBe(4);
    expect(lastStorage[4]).toBe(4);
  });

  it("rejects operations after disposal", () => {
    const gl = createMockGL2();
    const target = new MultiTarget(gl, { width: 2, height: 2 });

    target.dispose();

    expect(target.disposed).toBe(true);
    expect(() => target.bind()).toThrow("MultiTarget has been disposed.");
    expect(() => target.readPixelsInto(new Uint8Array(16), 0)).toThrow("disposed");
  });
});
