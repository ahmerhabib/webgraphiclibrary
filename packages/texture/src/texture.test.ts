import { describe, expect, it } from "vitest";
import { Texture2D, readTexturePixels, readTexturePixelsInto } from "./index";

type Call = [name: string, ...args: unknown[]];

function createMockGL(overrides: Record<string, unknown> = {}) {
  const calls: Call[] = [];
  const texture = { type: "texture" };
  const framebuffer = { type: "framebuffer" };
  let textureBinding: unknown = null;
  let framebufferBinding: unknown = null;
  let flipY: unknown = 0;
  let premultiplyAlpha: unknown = 0;

  const gl = {
    calls,
    TEXTURE_2D: 0x0de1,
    TEXTURE_BINDING_2D: 0x8069,
    FRAMEBUFFER: 0x8d40,
    FRAMEBUFFER_BINDING: 0x8ca6,
    COLOR_ATTACHMENT0: 0x8ce0,
    RGBA: 0x1908,
    UNSIGNED_BYTE: 0x1401,
    LINEAR: 0x2601,
    CLAMP_TO_EDGE: 0x812f,
    UNPACK_FLIP_Y_WEBGL: 0x9240,
    UNPACK_PREMULTIPLY_ALPHA_WEBGL: 0x9241,
    TEXTURE_MIN_FILTER: 0x2801,
    TEXTURE_MAG_FILTER: 0x2800,
    TEXTURE_WRAP_S: 0x2802,
    TEXTURE_WRAP_T: 0x2803,
    FRAMEBUFFER_COMPLETE: 0x8cd5,
    createTexture: () => texture,
    createFramebuffer: () => framebuffer,
    bindTexture: (target: number, value: unknown) => {
      if (target === gl.TEXTURE_2D) {
        textureBinding = value;
      }

      calls.push(["bindTexture", target, value]);
    },
    bindFramebuffer: (target: number, value: unknown) => {
      if (target === gl.FRAMEBUFFER) {
        framebufferBinding = value;
      }

      calls.push(["bindFramebuffer", target, value]);
    },
    texParameteri: (...args: unknown[]) => calls.push(["texParameteri", ...args]),
    pixelStorei: (pname: number, value: unknown) => {
      if (pname === gl.UNPACK_FLIP_Y_WEBGL) {
        flipY = value;
      }

      if (pname === gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL) {
        premultiplyAlpha = value;
      }

      calls.push(["pixelStorei", pname, value]);
    },
    generateMipmap: (...args: unknown[]) => calls.push(["generateMipmap", ...args]),
    texImage2D: (...args: unknown[]) => calls.push(["texImage2D", ...args]),
    framebufferTexture2D: (...args: unknown[]) => calls.push(["framebufferTexture2D", ...args]),
    checkFramebufferStatus: () => 0x8cd5,
    readPixels: (...args: unknown[]) => calls.push(["readPixels", ...args]),
    getParameter: (parameter: number) => {
      if (parameter === gl.TEXTURE_BINDING_2D) {
        return textureBinding;
      }

      if (parameter === gl.FRAMEBUFFER_BINDING) {
        return framebufferBinding;
      }

      if (parameter === gl.UNPACK_FLIP_Y_WEBGL) {
        return flipY;
      }

      if (parameter === gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL) {
        return premultiplyAlpha;
      }

      return null;
    },
    deleteTexture: (...args: unknown[]) => calls.push(["deleteTexture", ...args]),
    deleteFramebuffer: (...args: unknown[]) => calls.push(["deleteFramebuffer", ...args]),
    ...overrides
  } as unknown as WebGLRenderingContext & { calls: Call[] };

  return gl;
}

describe("Texture2D", () => {
  it("rejects a non-WebGL rendering context", () => {
    expect(
      () => new Texture2D({} as unknown as WebGLRenderingContext, { width: 8, height: 4 })
    ).toThrow("gl must be a WebGL rendering context.");
  });

  it("allocates a 2D texture with sampler parameters", () => {
    const gl = createMockGL();
    const texture = new Texture2D(gl, { width: 8, height: 4 });

    expect(texture.width).toBe(8);
    expect(texture.height).toBe(4);
    expect(gl.calls.filter(([name]) => name === "texParameteri")).toHaveLength(4);
    expect(gl.calls.some(([name]) => name === "texImage2D")).toBe(true);
  });

  it("binds within withBound and restores the previous texture binding", () => {
    const gl = createMockGL();
    const previous = { type: "previous-texture" };
    const texture = new Texture2D(gl, { width: 4, height: 4 });
    gl.bindTexture(gl.TEXTURE_2D, previous);

    let boundDuringCallback: unknown;
    const result = texture.withBound(() => {
      boundDuringCallback = gl.getParameter(gl.TEXTURE_BINDING_2D);
      return "done";
    });

    expect(boundDuringCallback).toBe(texture.texture);
    expect(result).toBe("done");
    expect(gl.getParameter(gl.TEXTURE_BINDING_2D)).toBe(previous);
  });

  it("restores the previous texture binding after upload", () => {
    const gl = createMockGL();
    const previousTexture = { type: "previous-texture" };
    const texture = new Texture2D(gl, { width: 8, height: 4 });
    gl.bindTexture(gl.TEXTURE_2D, previousTexture);

    texture.upload({ width: 16, height: 8 });

    expect(texture.width).toBe(16);
    expect(texture.height).toBe(8);
    expect(gl.getParameter(gl.TEXTURE_BINDING_2D)).toBe(previousTexture);
  });

  it("reads texture pixels through a temporary framebuffer and restores bindings", () => {
    const gl = createMockGL();
    const texture = new Texture2D(gl, { width: 2, height: 2 });
    const previousFramebuffer = { type: "previous-framebuffer" };
    const previousTexture = { type: "previous-texture" };
    gl.bindFramebuffer(gl.FRAMEBUFFER, previousFramebuffer);
    gl.bindTexture(gl.TEXTURE_2D, previousTexture);

    const pixels = readTexturePixels(gl, texture);

    expect(pixels).toBeInstanceOf(Uint8Array);
    expect(pixels).toHaveLength(16);
    expect(gl.calls.some(([name]) => name === "readPixels")).toBe(true);
    expect(gl.calls.filter(([name]) => name === "deleteFramebuffer")).toHaveLength(1);
    expect(gl.getParameter(gl.FRAMEBUFFER_BINDING)).toBe(previousFramebuffer);
    expect(gl.getParameter(gl.TEXTURE_BINDING_2D)).toBe(previousTexture);
  });

  it("uploads from an image source and tracks its size", () => {
    const gl = createMockGL();
    const texture = new Texture2D(gl, { width: 1, height: 1 });
    const source = { width: 4, height: 2 } as unknown as ImageBitmap;

    texture.uploadImage(source);

    expect(texture.width).toBe(4);
    expect(texture.height).toBe(2);
    expect(gl.calls).toContainEqual([
      "texImage2D",
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      source
    ]);
  });

  it("applies flipY and premultiplyAlpha pixel-store options on image upload", () => {
    const gl = createMockGL();
    const texture = new Texture2D(gl, {
      width: 1,
      height: 1,
      flipY: true,
      premultiplyAlpha: true
    });

    texture.uploadImage({ width: 2, height: 2 } as unknown as ImageBitmap);

    expect(gl.calls).toContainEqual(["pixelStorei", gl.UNPACK_FLIP_Y_WEBGL, 1]);
    expect(gl.calls).toContainEqual(["pixelStorei", gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 1]);
  });

  it("uploads an image provided to the constructor", () => {
    const gl = createMockGL();
    const source = { width: 8, height: 8 } as unknown as ImageBitmap;

    const texture = new Texture2D(gl, { width: 1, height: 1, image: source });

    expect(texture.width).toBe(8);
    expect(texture.height).toBe(8);
    expect(gl.calls).toContainEqual([
      "texImage2D",
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      source
    ]);
  });

  it("reads video dimensions from videoWidth and videoHeight", () => {
    const gl = createMockGL();
    const texture = new Texture2D(gl, { width: 1, height: 1 });
    const video = { videoWidth: 640, videoHeight: 360 } as unknown as HTMLVideoElement;

    texture.uploadImage(video);

    expect(texture.width).toBe(640);
    expect(texture.height).toBe(360);
  });

  it("restores the previous texture binding after image upload", () => {
    const gl = createMockGL();
    const texture = new Texture2D(gl, { width: 1, height: 1 });
    const previous = { type: "previous-texture" };
    gl.bindTexture(gl.TEXTURE_2D, previous);

    texture.uploadImage({ width: 2, height: 2 } as unknown as ImageBitmap);

    expect(gl.getParameter(gl.TEXTURE_BINDING_2D)).toBe(previous);
  });

  it("generates mipmaps and restores the previous texture binding", () => {
    const gl = createMockGL();
    const texture = new Texture2D(gl, { width: 4, height: 4 });
    const previous = { type: "previous-texture" };
    gl.bindTexture(gl.TEXTURE_2D, previous);

    texture.generateMipmap();

    expect(gl.calls).toContainEqual(["generateMipmap", gl.TEXTURE_2D]);
    expect(gl.getParameter(gl.TEXTURE_BINDING_2D)).toBe(previous);
  });

  it("reads texture pixels into a provided array and returns it", () => {
    const gl = createMockGL();
    const texture = new Texture2D(gl, { width: 2, height: 2 });
    const out = new Uint8Array(2 * 2 * 4);

    const result = readTexturePixelsInto(gl, texture, out);

    expect(result).toBe(out);
    expect(gl.calls).toContainEqual(["readPixels", 0, 0, 2, 2, gl.RGBA, gl.UNSIGNED_BYTE, out]);
  });

  it("throws when the texture readback array is too small", () => {
    const gl = createMockGL();
    const texture = new Texture2D(gl, { width: 4, height: 4 });

    expect(() => readTexturePixelsInto(gl, texture, new Uint8Array(4))).toThrow(RangeError);
  });

  it("deletes the texture when allocation fails", () => {
    const gl = createMockGL({
      texImage2D: () => {
        throw new Error("allocation failed");
      }
    });

    expect(() => new Texture2D(gl, { width: 4, height: 4 })).toThrow("allocation failed");
    expect(gl.calls.filter(([name]) => name === "deleteTexture")).toHaveLength(1);
  });

  it("restores the previous texture binding when withBound throws", () => {
    const gl = createMockGL();
    const texture = new Texture2D(gl, { width: 4, height: 4 });
    const previous = { type: "previous-texture" };
    gl.bindTexture(gl.TEXTURE_2D, previous);

    expect(() =>
      texture.withBound(() => {
        throw new Error("boom");
      })
    ).toThrow("boom");
    expect(gl.getParameter(gl.TEXTURE_BINDING_2D)).toBe(previous);
  });

  it("disposes once and rejects upload after disposal", () => {
    const gl = createMockGL();
    const texture = new Texture2D(gl, { width: 8, height: 4 });

    texture.dispose();
    texture.dispose();

    expect(texture.disposed).toBe(true);
    expect(gl.calls.filter(([name]) => name === "deleteTexture")).toHaveLength(1);
    expect(() => texture.upload({ width: 4, height: 4 })).toThrow("Texture2D has been disposed.");
  });
});
