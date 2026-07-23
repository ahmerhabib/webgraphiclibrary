import { describe, expect, it } from "vitest";
import { FBO, Framebuffer } from "./index";

type Call = [name: string, ...args: unknown[]];

function createMockGL(overrides: Record<string, unknown> = {}) {
  const calls: Call[] = [];
  const framebuffer = { type: "framebuffer" };
  const texture = { type: "texture" };
  const renderbuffer = { type: "renderbuffer" };
  let framebufferBinding: unknown = null;
  let readFramebufferBinding: unknown = null;
  let textureBinding: unknown = null;
  let renderbufferBinding: unknown = null;

  const gl = {
    calls,
    FRAMEBUFFER: 0x8d40,
    READ_FRAMEBUFFER: 0x8ca8,
    READ_FRAMEBUFFER_BINDING: 0x8caa,
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
    FRAMEBUFFER_BINDING: 0x8ca6,
    TEXTURE_BINDING_2D: 0x8069,
    RENDERBUFFER_BINDING: 0x8ca7,
    createFramebuffer: () => framebuffer,
    createTexture: () => texture,
    createRenderbuffer: () => renderbuffer,
    getExtension: (...args: unknown[]) => {
      calls.push(["getExtension", ...args]);
      return {};
    },
    bindFramebuffer: (...args: unknown[]) => {
      // Per the WebGL2 spec, FRAMEBUFFER sets both binding points.
      if (args[0] === gl.FRAMEBUFFER) {
        framebufferBinding = args[1];
        readFramebufferBinding = args[1];
      }
      if (args[0] === gl.READ_FRAMEBUFFER) {
        readFramebufferBinding = args[1];
      }
      calls.push(["bindFramebuffer", ...args]);
    },
    bindTexture: (...args: unknown[]) => {
      textureBinding = args[1];
      calls.push(["bindTexture", ...args]);
    },
    bindRenderbuffer: (...args: unknown[]) => {
      renderbufferBinding = args[1];
      calls.push(["bindRenderbuffer", ...args]);
    },
    getParameter: (parameter: number) => {
      if (parameter === gl.FRAMEBUFFER_BINDING) {
        return framebufferBinding;
      }

      if (parameter === gl.READ_FRAMEBUFFER_BINDING) {
        return readFramebufferBinding;
      }

      if (parameter === gl.TEXTURE_BINDING_2D) {
        return textureBinding;
      }

      if (parameter === gl.RENDERBUFFER_BINDING) {
        return renderbufferBinding;
      }

      return null;
    },
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
  } as unknown as WebGLRenderingContext & {
    calls: Call[];
    READ_FRAMEBUFFER: number;
    READ_FRAMEBUFFER_BINDING: number;
  };

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

  it("cleans up allocated resources when framebuffer setup fails", () => {
    const gl = createMockGL({
      checkFramebufferStatus: () => 0x8cd6
    });

    expect(() => new Framebuffer(gl, { width: 16, height: 16, depth: true })).toThrow(
      "incomplete attachment"
    );
    expect(gl.calls.filter(([name]) => name === "deleteFramebuffer")).toHaveLength(1);
    expect(gl.calls.filter(([name]) => name === "deleteTexture")).toHaveLength(1);
    expect(gl.calls.filter(([name]) => name === "deleteRenderbuffer")).toHaveLength(1);
  });

  it("restores previous framebuffer, texture, and renderbuffer bindings after construction", () => {
    const gl = createMockGL();
    const previousFramebuffer = { type: "previous-framebuffer" };
    const previousTexture = { type: "previous-texture" };
    const previousRenderbuffer = { type: "previous-renderbuffer" };
    gl.bindFramebuffer(gl.FRAMEBUFFER, previousFramebuffer);
    gl.bindTexture(gl.TEXTURE_2D, previousTexture);
    gl.bindRenderbuffer(gl.RENDERBUFFER, previousRenderbuffer);

    new Framebuffer(gl, { width: 16, height: 16, depth: true });

    expect(gl.getParameter(gl.FRAMEBUFFER_BINDING)).toBe(previousFramebuffer);
    expect(gl.getParameter(gl.TEXTURE_BINDING_2D)).toBe(previousTexture);
    expect(gl.getParameter(gl.RENDERBUFFER_BINDING)).toBe(previousRenderbuffer);
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

  it("restores the previous framebuffer binding after scoped work", () => {
    const gl = createMockGL();
    const previousFramebuffer = { type: "previous-framebuffer" };
    gl.bindFramebuffer(gl.FRAMEBUFFER, previousFramebuffer);
    const framebuffer = new Framebuffer(gl, { width: 16, height: 16 });
    gl.bindFramebuffer(gl.FRAMEBUFFER, previousFramebuffer);

    framebuffer.withBound(() => {
      expect(gl.getParameter(gl.FRAMEBUFFER_BINDING)).toBe(framebuffer.framebuffer);
    });

    expect(gl.getParameter(gl.FRAMEBUFFER_BINDING)).toBe(previousFramebuffer);
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

  it("restores previous framebuffer, texture, and renderbuffer bindings after resize", () => {
    const gl = createMockGL();
    const previousFramebuffer = { type: "previous-framebuffer" };
    const previousTexture = { type: "previous-texture" };
    const previousRenderbuffer = { type: "previous-renderbuffer" };
    const framebuffer = new Framebuffer(gl, { width: 16, height: 16, depth: true });
    gl.bindFramebuffer(gl.FRAMEBUFFER, previousFramebuffer);
    gl.bindTexture(gl.TEXTURE_2D, previousTexture);
    gl.bindRenderbuffer(gl.RENDERBUFFER, previousRenderbuffer);

    framebuffer.resize({ width: 32, height: 24 });

    expect(gl.getParameter(gl.FRAMEBUFFER_BINDING)).toBe(previousFramebuffer);
    expect(gl.getParameter(gl.TEXTURE_BINDING_2D)).toBe(previousTexture);
    expect(gl.getParameter(gl.RENDERBUFFER_BINDING)).toBe(previousRenderbuffer);
  });

  it("keeps previous dimensions when resize allocation fails", () => {
    let texImageCalls = 0;
    const gl = createMockGL({
      texImage2D: (...args: unknown[]) => {
        texImageCalls += 1;
        gl.calls.push(["texImage2D", ...args]);

        if (texImageCalls === 2) {
          throw new Error("allocation failed");
        }
      }
    });
    const framebuffer = new Framebuffer(gl, { width: 16, height: 16 });

    expect(() => framebuffer.resize({ width: 32, height: 24 })).toThrow("allocation failed");
    expect(framebuffer.width).toBe(16);
    expect(framebuffer.height).toBe(16);
  });

  it("reallocates storage at the previous size when a resize fails", () => {
    let fail = false;
    const gl = createMockGL({
      checkFramebufferStatus: () => (fail ? 0x8cd6 : 0x8cd5)
    });
    const framebuffer = new Framebuffer(gl, { width: 16, height: 16, depth: true });

    fail = true;
    expect(() => framebuffer.resize({ width: 32, height: 24 })).toThrow();

    expect(framebuffer.width).toBe(16);
    expect(framebuffer.height).toBe(16);
    const texImageCalls = gl.calls.filter(([name]) => name === "texImage2D");
    const lastTexImage = texImageCalls[texImageCalls.length - 1] as unknown[];
    expect(lastTexImage[4]).toBe(16);
    expect(lastTexImage[5]).toBe(16);
    const storageCalls = gl.calls.filter(([name]) => name === "renderbufferStorage");
    const lastStorage = storageCalls[storageCalls.length - 1] as unknown[];
    expect(lastStorage[3]).toBe(16);
    expect(lastStorage[4]).toBe(16);
  });

  it("restores the read framebuffer binding around withBound on WebGL2", () => {
    const gl = createMockGL({ texStorage2D: () => undefined });
    const framebuffer = new Framebuffer(gl, { width: 8, height: 8 });
    const previousRead = { type: "read-framebuffer" };
    gl.bindFramebuffer(0x8ca8, previousRead);

    framebuffer.withBound(() => undefined);

    expect(gl.getParameter(0x8caa)).toBe(previousRead);
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

  it("enables the float color-buffer extension for float render targets on WebGL2", () => {
    const gl = createMockGL({ texStorage2D: () => undefined });

    new Framebuffer(gl, {
      width: 2,
      height: 2,
      internalFormat: 0x8814,
      format: gl.RGBA,
      type: gl.FLOAT
    });

    expect(gl.calls).toContainEqual(["getExtension", "EXT_color_buffer_float"]);
  });

  it("does not request float extensions for the default unsigned-byte target", () => {
    const gl = createMockGL({ texStorage2D: () => undefined });

    new Framebuffer(gl, { width: 2, height: 2 });

    expect(gl.calls.some(([name]) => name === "getExtension")).toBe(false);
  });

  it("invalidates attachments on a WebGL2 context", () => {
    const invalidateCalls: unknown[][] = [];
    const gl = createMockGL({
      texStorage2D: () => undefined,
      invalidateFramebuffer: (...args: unknown[]) => invalidateCalls.push(args)
    });
    const framebuffer = new Framebuffer(gl, { width: 2, height: 2 });

    framebuffer.invalidate();

    expect(invalidateCalls).toContainEqual([gl.FRAMEBUFFER, [gl.COLOR_ATTACHMENT0]]);
  });

  it("includes the depth attachment when invalidating a depth framebuffer", () => {
    const invalidateCalls: unknown[][] = [];
    const gl = createMockGL({
      texStorage2D: () => undefined,
      invalidateFramebuffer: (...args: unknown[]) => invalidateCalls.push(args)
    });
    const framebuffer = new Framebuffer(gl, { width: 2, height: 2, depth: true });

    framebuffer.invalidate();

    expect(invalidateCalls).toContainEqual([
      gl.FRAMEBUFFER,
      [gl.COLOR_ATTACHMENT0, gl.DEPTH_ATTACHMENT]
    ]);
  });

  it("throws when invalidate is used on a WebGL1 context", () => {
    const gl = createMockGL();
    const framebuffer = new Framebuffer(gl, { width: 2, height: 2 });

    expect(() => framebuffer.invalidate()).toThrow("WebGL2");
  });

  it("cleans up all resources when the framebuffer is incomplete", () => {
    const gl = createMockGL({ checkFramebufferStatus: () => 0x8cd6 });

    expect(() => new Framebuffer(gl, { width: 2, height: 2, depth: true })).toThrow();
    expect(gl.calls.filter(([name]) => name === "deleteFramebuffer")).toHaveLength(1);
    expect(gl.calls.filter(([name]) => name === "deleteTexture")).toHaveLength(1);
    expect(gl.calls.filter(([name]) => name === "deleteRenderbuffer")).toHaveLength(1);
  });

  it("restores the previous framebuffer binding when withBound throws", () => {
    const gl = createMockGL();
    const framebuffer = new Framebuffer(gl, { width: 2, height: 2 });
    const previous = { type: "previous-framebuffer" };
    gl.bindFramebuffer(gl.FRAMEBUFFER, previous);

    expect(() =>
      framebuffer.withBound(() => {
        throw new Error("boom");
      })
    ).toThrow("boom");
    expect(gl.getParameter(gl.FRAMEBUFFER_BINDING)).toBe(previous);
  });

  it("reads pixels into a provided array and returns it", () => {
    const gl = createMockGL();
    const framebuffer = new Framebuffer(gl, { width: 2, height: 2 });
    const out = new Uint8Array(2 * 2 * 4);

    const result = framebuffer.readPixelsInto(out);

    expect(result).toBe(out);
    expect(gl.calls).toContainEqual(["readPixels", 0, 0, 2, 2, gl.RGBA, gl.UNSIGNED_BYTE, out]);
  });

  it("throws when the readback array is too small", () => {
    const gl = createMockGL();
    const framebuffer = new Framebuffer(gl, { width: 4, height: 4 });

    expect(() => framebuffer.readPixelsInto(new Uint8Array(4))).toThrow(RangeError);
  });

  it("rejects readPixels for non-unsigned-byte readback", () => {
    const gl = createMockGL();
    const framebuffer = new Framebuffer(gl, {
      width: 2,
      height: 2,
      type: gl.FLOAT
    });

    expect(() => framebuffer.readPixels()).toThrow(
      "readPixels currently supports RGBA UNSIGNED_BYTE"
    );
  });

  it("restores the previous framebuffer binding after readPixels", () => {
    const gl = createMockGL();
    const previousFramebuffer = { type: "previous-framebuffer" };
    const framebuffer = new Framebuffer(gl, { width: 2, height: 2 });
    gl.bindFramebuffer(gl.FRAMEBUFFER, previousFramebuffer);

    framebuffer.readPixels();

    expect(gl.getParameter(gl.FRAMEBUFFER_BINDING)).toBe(previousFramebuffer);
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
