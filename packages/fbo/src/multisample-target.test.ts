import { describe, expect, it } from "vitest";
import { MultisampleTarget } from "./index";

type Call = [name: string, ...args: unknown[]];

function createMockGL2(overrides: Record<string, unknown> = {}) {
  const calls: Call[] = [];
  let drawBinding: unknown = null;
  let readBinding: unknown = null;
  let textureBinding: unknown = null;
  let renderbufferBinding: unknown = null;

  const gl = {
    calls,
    FRAMEBUFFER: 0x8d40,
    READ_FRAMEBUFFER: 0x8ca8,
    DRAW_FRAMEBUFFER: 0x8ca9,
    RENDERBUFFER: 0x8d41,
    TEXTURE_2D: 0x0de1,
    COLOR_ATTACHMENT0: 0x8ce0,
    DEPTH_ATTACHMENT: 0x8d00,
    DEPTH_STENCIL_ATTACHMENT: 0x821a,
    COLOR_BUFFER_BIT: 0x4000,
    RGBA: 0x1908,
    RGBA8: 0x8058,
    UNSIGNED_BYTE: 0x1401,
    DEPTH_COMPONENT24: 0x81a6,
    DEPTH24_STENCIL8: 0x88f0,
    LINEAR: 0x2601,
    NEAREST: 0x2600,
    CLAMP_TO_EDGE: 0x812f,
    TEXTURE_MIN_FILTER: 0x2801,
    TEXTURE_MAG_FILTER: 0x2800,
    TEXTURE_WRAP_S: 0x2802,
    TEXTURE_WRAP_T: 0x2803,
    FRAMEBUFFER_COMPLETE: 0x8cd5,
    FRAMEBUFFER_BINDING: 0x8ca6,
    READ_FRAMEBUFFER_BINDING: 0x8caa,
    TEXTURE_BINDING_2D: 0x8069,
    RENDERBUFFER_BINDING: 0x8ca7,
    MAX_SAMPLES: 0x8d57,
    texStorage2D: () => undefined,
    createFramebuffer: () => ({ tag: "framebuffer" }),
    createTexture: () => ({ tag: "texture" }),
    createRenderbuffer: () => ({ tag: "renderbuffer" }),
    bindFramebuffer: (target: number, value: unknown) => {
      if (target === gl.FRAMEBUFFER) {
        drawBinding = value;
        readBinding = value;
      } else if (target === gl.READ_FRAMEBUFFER) {
        readBinding = value;
      } else if (target === gl.DRAW_FRAMEBUFFER) {
        drawBinding = value;
      }
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
    renderbufferStorageMultisample: (...args: unknown[]) =>
      calls.push(["renderbufferStorageMultisample", ...args]),
    framebufferRenderbuffer: (...args: unknown[]) =>
      calls.push(["framebufferRenderbuffer", ...args]),
    blitFramebuffer: (...args: unknown[]) => calls.push(["blitFramebuffer", ...args]),
    readBuffer: (...args: unknown[]) => calls.push(["readBuffer", ...args]),
    readPixels: (...args: unknown[]) => calls.push(["readPixels", ...args]),
    checkFramebufferStatus: () => 0x8cd5,
    getParameter: (parameter: number) => {
      if (parameter === gl.FRAMEBUFFER_BINDING) return drawBinding;
      if (parameter === gl.READ_FRAMEBUFFER_BINDING) return readBinding;
      if (parameter === gl.TEXTURE_BINDING_2D) return textureBinding;
      if (parameter === gl.RENDERBUFFER_BINDING) return renderbufferBinding;
      if (parameter === gl.MAX_SAMPLES) return 4;
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
  return { ...createMockGL2(), texStorage2D: undefined } as unknown as WebGLRenderingContext;
}

describe("MultisampleTarget", () => {
  it("requires a WebGL2 context", () => {
    expect(() => new MultisampleTarget(createMockGL1(), { width: 4, height: 4 })).toThrow(
      "MultisampleTarget requires a WebGL2 context."
    );
  });

  it("allocates a multisampled color renderbuffer and a resolve texture", () => {
    const gl = createMockGL2();
    const target = new MultisampleTarget(gl, { width: 8, height: 8, samples: 4 });

    expect(target.texture).toBeTruthy();
    expect(target.framebuffer).toBeTruthy();
    expect(target.resolveFramebuffer).toBeTruthy();
    expect(target.samples).toBe(4);
    expect(gl.calls).toContainEqual([
      "renderbufferStorageMultisample",
      gl.RENDERBUFFER,
      4,
      gl.RGBA8,
      8,
      8
    ]);
    expect(gl.calls.some(([name]) => name === "texImage2D")).toBe(true);
  });

  it("clamps the sample count to MAX_SAMPLES", () => {
    const gl = createMockGL2();
    const target = new MultisampleTarget(gl, { width: 4, height: 4, samples: 16 });
    expect(target.samples).toBe(4);
  });

  it("creates a multisampled depth renderbuffer when requested", () => {
    const gl = createMockGL2();
    const target = new MultisampleTarget(gl, { width: 4, height: 4, depth: true });

    expect(target.depthRenderbuffer).not.toBeNull();
    const depthCalls = gl.calls.filter(([name]) => name === "renderbufferStorageMultisample");
    expect(depthCalls).toContainEqual([
      "renderbufferStorageMultisample",
      gl.RENDERBUFFER,
      target.samples,
      gl.DEPTH_COMPONENT24,
      4,
      4
    ]);
  });

  it("binds the multisampled draw framebuffer in withBound", () => {
    const gl = createMockGL2();
    const target = new MultisampleTarget(gl, { width: 4, height: 4 });

    let boundDuring: unknown;
    target.withBound(() => {
      boundDuring = gl.getParameter(gl.FRAMEBUFFER_BINDING);
    });

    expect(boundDuring).toBe(target.framebuffer);
  });

  it("resolves by blitting the draw framebuffer into the resolve framebuffer", () => {
    const gl = createMockGL2();
    const target = new MultisampleTarget(gl, { width: 6, height: 5 });

    target.resolve();

    expect(gl.calls).toContainEqual(["bindFramebuffer", gl.READ_FRAMEBUFFER, target.framebuffer]);
    expect(gl.calls).toContainEqual([
      "bindFramebuffer",
      gl.DRAW_FRAMEBUFFER,
      target.resolveFramebuffer
    ]);
    expect(gl.calls).toContainEqual([
      "blitFramebuffer",
      0,
      0,
      6,
      5,
      0,
      0,
      6,
      5,
      gl.COLOR_BUFFER_BIT,
      gl.NEAREST
    ]);
    expect(gl.getParameter(gl.FRAMEBUFFER_BINDING)).toBeNull();
    expect(gl.getParameter(gl.READ_FRAMEBUFFER_BINDING)).toBeNull();
  });

  it("reads resolved pixels into a provided array", () => {
    const gl = createMockGL2();
    const target = new MultisampleTarget(gl, { width: 2, height: 2 });
    const out = new Uint8Array(2 * 2 * 4);

    const result = target.readPixelsInto(out);

    expect(result).toBe(out);
    expect(gl.calls).toContainEqual([
      "bindFramebuffer",
      gl.READ_FRAMEBUFFER,
      target.resolveFramebuffer
    ]);
    expect(gl.calls).toContainEqual(["readPixels", 0, 0, 2, 2, gl.RGBA, gl.UNSIGNED_BYTE, out]);
  });

  it("reallocates storage on resize", () => {
    const gl = createMockGL2();
    const target = new MultisampleTarget(gl, { width: 4, height: 4 });
    const beforeColor = gl.calls.filter(
      ([name]) => name === "renderbufferStorageMultisample"
    ).length;
    const beforeTex = gl.calls.filter(([name]) => name === "texImage2D").length;

    target.resize({ width: 8, height: 8 });

    expect(
      gl.calls.filter(([name]) => name === "renderbufferStorageMultisample").length - beforeColor
    ).toBe(1);
    expect(gl.calls.filter(([name]) => name === "texImage2D").length - beforeTex).toBe(1);
    expect(target.width).toBe(8);
  });

  it("disposes both framebuffers, renderbuffers, and the resolve texture once", () => {
    const gl = createMockGL2();
    const target = new MultisampleTarget(gl, { width: 4, height: 4, depth: true });

    target.dispose();
    target.dispose();

    expect(target.disposed).toBe(true);
    expect(gl.calls.filter(([name]) => name === "deleteFramebuffer")).toHaveLength(2);
    expect(gl.calls.filter(([name]) => name === "deleteRenderbuffer")).toHaveLength(2);
    expect(gl.calls.filter(([name]) => name === "deleteTexture")).toHaveLength(1);
  });
});
