import { describe, expect, it } from "vitest";
import { CubemapTexture } from "./index";

type Call = [name: string, ...args: unknown[]];

function createMockGL(overrides: Record<string, unknown> = {}) {
  const calls: Call[] = [];
  const texture = { type: "cubemap-texture" };
  let cubemapBinding: unknown = null;
  let flipY: unknown = 0;
  let premultiplyAlpha: unknown = 0;

  const gl = {
    calls,
    TEXTURE_CUBE_MAP: 0x8513,
    TEXTURE_BINDING_CUBE_MAP: 0x8514,
    TEXTURE_CUBE_MAP_POSITIVE_X: 0x8515,
    TEXTURE_2D: 0x0de1,
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
    createFramebuffer: () => ({}),
    bindFramebuffer: () => undefined,
    checkFramebufferStatus: () => 0x8cd5,
    createTexture: () => texture,
    bindTexture: (target: number, value: unknown) => {
      if (target === gl.TEXTURE_CUBE_MAP) {
        cubemapBinding = value;
      }

      calls.push(["bindTexture", target, value]);
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
    texImage2D: (...args: unknown[]) => calls.push(["texImage2D", ...args]),
    generateMipmap: (...args: unknown[]) => calls.push(["generateMipmap", ...args]),
    getParameter: (parameter: number) => {
      if (parameter === gl.TEXTURE_BINDING_CUBE_MAP) {
        return cubemapBinding;
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
    ...overrides
  } as unknown as WebGLRenderingContext & { calls: Call[] };

  return gl;
}

describe("CubemapTexture", () => {
  it("rejects a non-WebGL rendering context", () => {
    expect(() => new CubemapTexture({} as unknown as WebGLRenderingContext, { size: 16 })).toThrow(
      "gl must be a WebGL rendering context."
    );
  });

  it("allocates all six faces with sampler parameters", () => {
    const gl = createMockGL();
    const cubemap = new CubemapTexture(gl, { size: 16 });

    expect(cubemap.size).toBe(16);
    expect(gl.calls.filter(([name]) => name === "texParameteri")).toHaveLength(4);

    const faces = gl.calls.filter(([name]) => name === "texImage2D");
    expect(faces).toHaveLength(6);
    for (let face = 0; face < 6; face += 1) {
      expect(faces[face]).toEqual([
        "texImage2D",
        gl.TEXTURE_CUBE_MAP_POSITIVE_X + face,
        0,
        gl.RGBA,
        16,
        16,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        null
      ]);
    }
  });

  it("uploads per-face typed-array data from the constructor", () => {
    const gl = createMockGL();
    const data = Array.from({ length: 6 }, () => new Uint8Array(4 * 4 * 4));

    new CubemapTexture(gl, { size: 4, data });

    const faces = gl.calls.filter(([name]) => name === "texImage2D");
    expect(faces[3]?.[9]).toBe(data[3]);
  });

  it("rejects data or faces arrays that do not hold six entries", () => {
    const gl = createMockGL();
    expect(() => new CubemapTexture(gl, { size: 4, data: [null, null] })).toThrow(
      "must hold 6 faces"
    );
    expect(
      () =>
        new CubemapTexture(gl, {
          size: 4,
          faces: [{ width: 4, height: 4 }] as unknown as ImageBitmap[]
        })
    ).toThrow("must hold 6 sources");
  });

  it("rejects invalid sizes", () => {
    const gl = createMockGL();
    expect(() => new CubemapTexture(gl, { size: 0 })).toThrow(RangeError);
    expect(() => new CubemapTexture(gl, { size: 2.5 })).toThrow(TypeError);
  });

  it("restores the previous cubemap binding after construction", () => {
    const gl = createMockGL();
    const previous = { type: "previous-cubemap" };
    gl.bindTexture(0x8513, previous);

    new CubemapTexture(gl, { size: 8 });

    expect(gl.getParameter(0x8514)).toBe(previous);
  });

  it("binds within withBound and restores the previous binding", () => {
    const gl = createMockGL();
    const previous = { type: "previous-cubemap" };
    const cubemap = new CubemapTexture(gl, { size: 8 });
    gl.bindTexture(0x8513, previous);

    let boundDuring: unknown;
    const result = cubemap.withBound(() => {
      boundDuring = gl.getParameter(0x8514);
      return "ok";
    });

    expect(boundDuring).toBe(cubemap.texture);
    expect(result).toBe("ok");
    expect(gl.getParameter(0x8514)).toBe(previous);
  });

  it("uploads a face image with the matching target and restores pixel-store state", () => {
    const gl = createMockGL();
    const cubemap = new CubemapTexture(gl, { size: 8, flipY: true });
    const source = { width: 8, height: 8 } as unknown as ImageBitmap;

    cubemap.uploadFace(2, source);

    expect(gl.calls).toContainEqual([
      "texImage2D",
      gl.TEXTURE_CUBE_MAP_POSITIVE_X + 2,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      source
    ]);
    expect(gl.getParameter(gl.UNPACK_FLIP_Y_WEBGL)).toBe(0);
  });

  it("rejects face uploads that do not match the cubemap size", () => {
    const gl = createMockGL();
    const cubemap = new CubemapTexture(gl, { size: 8 });

    expect(() => cubemap.uploadFace(0, { width: 4, height: 8 } as unknown as ImageBitmap)).toThrow(
      "must be 8×8"
    );
    expect(() => cubemap.uploadFace(0, { width: 0, height: 0 } as unknown as ImageBitmap)).toThrow(
      "must be 8×8"
    );
  });

  it("rejects out-of-range face indices", () => {
    const gl = createMockGL();
    const cubemap = new CubemapTexture(gl, { size: 4 });
    const source = { width: 4, height: 4 } as unknown as ImageBitmap;

    expect(() => cubemap.uploadFace(6 as never, source)).toThrow("0–5");
    expect(() => cubemap.uploadFaceData(-1 as never, null)).toThrow("0–5");
  });

  it("uploads six image faces from the constructor", () => {
    const gl = createMockGL();
    const faces = Array.from(
      { length: 6 },
      () => ({ width: 4, height: 4 }) as unknown as ImageBitmap
    );

    new CubemapTexture(gl, { size: 4, faces });

    const uploads = gl.calls.filter(
      ([name, target]) => name === "texImage2D" && typeof target === "number"
    );
    expect(uploads).toHaveLength(6);
    expect(uploads[5]?.[1]).toBe(gl.TEXTURE_CUBE_MAP_POSITIVE_X + 5);
  });

  it("reallocates a single face from typed-array data", () => {
    const gl = createMockGL();
    const cubemap = new CubemapTexture(gl, { size: 4 });
    const previous = { type: "previous-cubemap" };
    gl.bindTexture(0x8513, previous);
    const data = new Uint8Array(4 * 4 * 4);

    cubemap.uploadFaceData(1, data);

    const faces = gl.calls.filter(([name]) => name === "texImage2D");
    expect(faces.at(-1)).toEqual([
      "texImage2D",
      gl.TEXTURE_CUBE_MAP_POSITIVE_X + 1,
      0,
      gl.RGBA,
      4,
      4,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      data
    ]);
    expect(gl.getParameter(0x8514)).toBe(previous);
  });

  it("generates mipmaps for the cube target and restores the binding", () => {
    const gl = createMockGL();
    const cubemap = new CubemapTexture(gl, { size: 8 });
    const previous = { type: "previous-cubemap" };
    gl.bindTexture(0x8513, previous);

    cubemap.generateMipmap();

    expect(gl.calls).toContainEqual(["generateMipmap", gl.TEXTURE_CUBE_MAP]);
    expect(gl.getParameter(0x8514)).toBe(previous);
  });

  it("deletes the texture when construction fails", () => {
    const gl = createMockGL({
      texImage2D: () => {
        throw new Error("allocation failed");
      }
    });

    expect(() => new CubemapTexture(gl, { size: 4 })).toThrow("allocation failed");
    expect(gl.calls.filter(([name]) => name === "deleteTexture")).toHaveLength(1);
  });

  it("disposes once and rejects use after disposal", () => {
    const gl = createMockGL();
    const cubemap = new CubemapTexture(gl, { size: 4 });

    cubemap.dispose();
    cubemap.dispose();

    expect(cubemap.disposed).toBe(true);
    expect(gl.calls.filter(([name]) => name === "deleteTexture")).toHaveLength(1);
    expect(() => cubemap.bind()).toThrow("CubemapTexture has been disposed.");
    expect(() => cubemap.uploadFaceData(0, null)).toThrow("disposed");
  });
});
