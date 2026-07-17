import {
  WebGLError,
  assertNotDisposed,
  assertPositiveIntegerDimension,
  isWebGL2,
  isWebGLContext,
  withSavedBindings as saveBindings
} from "../../core/src/index";
import type { GLContext } from "../../core/src/index";

/** Format options for a single color attachment of a {@link MultiTarget}. */
export interface ColorAttachmentSpec {
  /** Sized internal format for the texture. Defaults to `RGBA`. */
  internalFormat?: number;
  /** Pixel format of the supplied data. Defaults to `RGBA`. */
  format?: number;
  /** Pixel data type. Defaults to `UNSIGNED_BYTE`. */
  type?: number;
  /** `TEXTURE_MIN_FILTER`. Defaults to `LINEAR`. */
  minFilter?: number;
  /** `TEXTURE_MAG_FILTER`. Defaults to `LINEAR`. */
  magFilter?: number;
  /** `TEXTURE_WRAP_S`. Defaults to `CLAMP_TO_EDGE`. */
  wrapS?: number;
  /** `TEXTURE_WRAP_T`. Defaults to `CLAMP_TO_EDGE`. */
  wrapT?: number;
}

/** Constructor options for {@link MultiTarget}. */
export interface MultiTargetOptions {
  /** Target width in pixels (positive integer). */
  width: number;
  /** Target height in pixels (positive integer). */
  height: number;
  /** A count of RGBA attachments, or per-attachment format specs. Defaults to 2. */
  attachments?: number | ColorAttachmentSpec[];
  /** Attach a depth renderbuffer. Defaults to `false`. */
  depth?: boolean;
  /** Attach a combined depth-stencil renderbuffer. Defaults to `false`. */
  stencil?: boolean;
}

/** Options for {@link MultiTarget.resize}. */
export interface MultiTargetResizeOptions {
  /** New width in pixels (positive integer). */
  width: number;
  /** New height in pixels (positive integer). */
  height: number;
}

/** The minimal canvas shape read by {@link MultiTarget.resizeToCanvas}. */
export type MultiTargetCanvasSize = Pick<HTMLCanvasElement, "width" | "height">;

interface ResolvedAttachment {
  internalFormat: number;
  format: number;
  type: number;
  minFilter: number;
  magFilter: number;
  wrapS: number;
  wrapT: number;
}

/**
 * A WebGL2 off-screen target with multiple color attachments (MRT), each
 * backed by a sampleable texture, plus optional depth/stencil storage. Bind it,
 * render with `gl_FragData` / `layout(location = n) out`, and sample any
 * `textures[n]` afterwards.
 */
export class MultiTarget {
  /** The WebGL2 rendering context this target belongs to. */
  public readonly gl: WebGL2RenderingContext;
  /** The underlying `WebGLFramebuffer` handle. */
  public readonly framebuffer: WebGLFramebuffer;
  /** The color attachment textures, indexed by draw-buffer location. */
  public readonly textures: readonly WebGLTexture[];
  /** Convenience alias for `textures[0]`. */
  public readonly texture: WebGLTexture;
  /** The depth/stencil renderbuffer, or `null` when neither was requested. */
  public readonly renderbuffer: WebGLRenderbuffer | null;
  /** Current width in pixels. Updated by {@link MultiTarget.resize}. */
  public width: number;
  /** Current height in pixels. Updated by {@link MultiTarget.resize}. */
  public height: number;

  private readonly specs: readonly ResolvedAttachment[];
  private readonly stencil: boolean;
  private isDisposed = false;

  /**
   * Allocate the framebuffer, its color textures, and any depth/stencil
   * renderbuffer, then verify completeness. Restores prior bindings.
   *
   * @throws {TypeError} if `gl` is not a WebGL rendering context, or the
   *   dimensions are not positive integers.
   * @throws {WebGLError} if `gl` is not WebGL2, allocation fails, too many
   *   attachments are requested, or the framebuffer is incomplete.
   */
  constructor(gl: GLContext, options: MultiTargetOptions) {
    if (!isWebGLContext(gl)) {
      throw new TypeError("gl must be a WebGL rendering context.");
    }
    if (!isWebGL2(gl)) {
      throw new WebGLError("MultiTarget requires a WebGL2 context.");
    }

    this.gl = gl;
    this.width = assertPositiveIntegerDimension("width", options.width);
    this.height = assertPositiveIntegerDimension("height", options.height);
    this.stencil = options.stencil ?? false;
    this.specs = resolveAttachments(gl, options.attachments ?? 2);

    const framebuffer = gl.createFramebuffer() as WebGLFramebuffer | null;
    if (framebuffer === null) {
      throw new WebGLError("Failed to create framebuffer.");
    }
    this.framebuffer = framebuffer;

    const textures: WebGLTexture[] = [];
    this.renderbuffer = null;

    try {
      for (let i = 0; i < this.specs.length; i += 1) {
        const texture = gl.createTexture() as WebGLTexture | null;
        if (texture === null) {
          throw new WebGLError("Failed to create framebuffer texture.");
        }
        textures.push(texture);
      }
      this.textures = textures;
      this.texture = textures[0] as WebGLTexture;

      if (options.depth === true || options.stencil === true) {
        const renderbuffer = gl.createRenderbuffer() as WebGLRenderbuffer | null;
        if (renderbuffer === null) {
          throw new WebGLError("Failed to create framebuffer renderbuffer.");
        }
        this.renderbuffer = renderbuffer;
      }

      this.withSavedBindings(() => {
        this.configureAttachments();
        this.assertComplete();
      });
    } catch (error) {
      gl.deleteFramebuffer(framebuffer);
      for (const texture of textures) {
        gl.deleteTexture(texture);
      }
      if (this.renderbuffer !== null) {
        gl.deleteRenderbuffer(this.renderbuffer);
      }
      throw error;
    }
  }

  /** Whether {@link MultiTarget.dispose} has been called. */
  public get disposed(): boolean {
    return this.isDisposed;
  }

  /** Bind this target's framebuffer for drawing. */
  public bind(): void {
    assertNotDisposed("MultiTarget", this.isDisposed);
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.framebuffer);
  }

  /** Unbind the framebuffer, restoring the default (bind `null`). */
  public unbind(): void {
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
  }

  /**
   * Bind this target, run `render`, then restore the previously bound
   * framebuffer, texture, and renderbuffer.
   *
   * @returns whatever `render` returns.
   */
  public withBound<T>(render: () => T): T {
    return this.withSavedBindings(() => {
      this.bind();
      return render();
    });
  }

  /**
   * Reallocate every attachment to a new size. On failure the previous
   * dimensions are restored.
   *
   * @throws {TypeError} if the dimensions are not positive integers.
   * @throws {WebGLError} if the resized framebuffer is incomplete.
   */
  public resize(options: MultiTargetResizeOptions): void {
    assertNotDisposed("MultiTarget", this.isDisposed);
    const previousWidth = this.width;
    const previousHeight = this.height;
    const nextWidth = assertPositiveIntegerDimension("width", options.width);
    const nextHeight = assertPositiveIntegerDimension("height", options.height);

    this.withSavedBindings(() => {
      this.width = nextWidth;
      this.height = nextHeight;

      try {
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.framebuffer);
        for (let i = 0; i < this.textures.length; i += 1) {
          this.allocateTexture(i);
        }
        if (this.renderbuffer !== null) {
          this.allocateRenderbuffer();
        }
        this.assertComplete();
      } catch (error) {
        this.width = previousWidth;
        this.height = previousHeight;
        throw error;
      }
    });
  }

  /** Resize to match a canvas's backing-store dimensions. */
  public resizeToCanvas(canvas: MultiTargetCanvasSize): void {
    this.resize({ width: canvas.width, height: canvas.height });
  }

  /**
   * Read one attachment's RGBA pixels into a newly allocated `Uint8Array`.
   * Prefer {@link MultiTarget.readPixelsInto} in a hot loop.
   */
  public readPixels(attachmentIndex = 0): Uint8Array {
    return this.readPixelsInto(new Uint8Array(this.width * this.height * 4), attachmentIndex);
  }

  /**
   * Read one attachment's RGBA pixels into `out` (reused across frames).
   * Restores the prior framebuffer binding.
   *
   * @throws {RangeError} if the attachment does not exist or `out` is too small.
   * @throws {WebGLError} if the attachment is not RGBA `UNSIGNED_BYTE`.
   * @returns the same `out` array.
   */
  public readPixelsInto(out: Uint8Array, attachmentIndex = 0): Uint8Array {
    assertNotDisposed("MultiTarget", this.isDisposed);
    const gl = this.gl;
    const spec = this.specs[attachmentIndex];

    if (spec === undefined) {
      throw new RangeError(`Color attachment ${attachmentIndex} does not exist.`);
    }
    if (spec.format !== gl.RGBA || spec.type !== gl.UNSIGNED_BYTE) {
      throw new WebGLError("readPixels currently supports RGBA UNSIGNED_BYTE attachments only.");
    }

    const required = this.width * this.height * 4;
    if (out.length < required) {
      throw new RangeError(
        `Readback array must hold at least ${required} bytes, received ${out.length}.`
      );
    }

    this.withSavedBindings(() => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
      gl.readBuffer(gl.COLOR_ATTACHMENT0 + attachmentIndex);
      gl.readPixels(0, 0, this.width, this.height, spec.format, spec.type, out);
    });
    return out;
  }

  /**
   * Delete the framebuffer, all attachment textures, and any renderbuffer.
   * Idempotent.
   */
  public dispose(): void {
    if (this.isDisposed) {
      return;
    }

    this.gl.deleteFramebuffer(this.framebuffer);
    for (const texture of this.textures) {
      this.gl.deleteTexture(texture);
    }
    if (this.renderbuffer !== null) {
      this.gl.deleteRenderbuffer(this.renderbuffer);
    }

    this.isDisposed = true;
  }

  private configureAttachments(): void {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    const drawBuffers: number[] = [];

    for (let i = 0; i < this.textures.length; i += 1) {
      const texture = this.textures[i] as WebGLTexture;
      const spec = this.specs[i] as ResolvedAttachment;
      const attachment = gl.COLOR_ATTACHMENT0 + i;

      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, spec.minFilter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, spec.magFilter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, spec.wrapS);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, spec.wrapT);
      this.allocateTexture(i);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, attachment, gl.TEXTURE_2D, texture, 0);
      drawBuffers.push(attachment);
    }

    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.drawBuffers(drawBuffers);

    if (this.renderbuffer !== null) {
      this.allocateRenderbuffer();
    }
  }

  private allocateTexture(index: number): void {
    const gl = this.gl;
    const spec = this.specs[index] as ResolvedAttachment;
    gl.bindTexture(gl.TEXTURE_2D, this.textures[index] as WebGLTexture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      spec.internalFormat,
      this.width,
      this.height,
      0,
      spec.format,
      spec.type,
      null
    );
  }

  private allocateRenderbuffer(): void {
    const gl = this.gl;
    if (this.renderbuffer === null) {
      return;
    }

    const attachment = this.stencil ? gl.DEPTH_STENCIL_ATTACHMENT : gl.DEPTH_ATTACHMENT;
    const storage = this.stencil ? gl.DEPTH_STENCIL : gl.DEPTH_COMPONENT16;

    gl.bindRenderbuffer(gl.RENDERBUFFER, this.renderbuffer);
    gl.renderbufferStorage(gl.RENDERBUFFER, storage, this.width, this.height);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, attachment, gl.RENDERBUFFER, this.renderbuffer);
    gl.bindRenderbuffer(gl.RENDERBUFFER, null);
  }

  private assertComplete(): void {
    const status = this.gl.checkFramebufferStatus(this.gl.FRAMEBUFFER);
    if (status !== this.gl.FRAMEBUFFER_COMPLETE) {
      throw new WebGLError(`Multi-target framebuffer is incomplete (status ${status}).`);
    }
  }

  private withSavedBindings<T>(operation: () => T): T {
    const gl = this.gl;

    return saveBindings(
      gl,
      [
        {
          binding: gl.FRAMEBUFFER_BINDING,
          restore: (value) => gl.bindFramebuffer(gl.FRAMEBUFFER, value as WebGLFramebuffer | null)
        },
        {
          binding: gl.TEXTURE_BINDING_2D,
          restore: (value) => gl.bindTexture(gl.TEXTURE_2D, value as WebGLTexture | null)
        },
        {
          binding: gl.RENDERBUFFER_BINDING,
          restore: (value) =>
            gl.bindRenderbuffer(gl.RENDERBUFFER, value as WebGLRenderbuffer | null)
        }
      ],
      operation
    );
  }
}

function resolveAttachments(
  gl: WebGL2RenderingContext,
  attachments: number | ColorAttachmentSpec[]
): ResolvedAttachment[] {
  const specs: ColorAttachmentSpec[] =
    typeof attachments === "number" ? Array.from({ length: attachments }, () => ({})) : attachments;

  if (specs.length < 1) {
    throw new WebGLError("MultiTarget requires at least one color attachment.");
  }

  const max = gl.getParameter(gl.MAX_COLOR_ATTACHMENTS) as number;
  if (specs.length > max) {
    throw new WebGLError(
      `Requested ${specs.length} color attachments but the context supports ${max}.`
    );
  }

  return specs.map((spec) => ({
    internalFormat: spec.internalFormat ?? gl.RGBA,
    format: spec.format ?? gl.RGBA,
    type: spec.type ?? gl.UNSIGNED_BYTE,
    minFilter: spec.minFilter ?? gl.LINEAR,
    magFilter: spec.magFilter ?? gl.LINEAR,
    wrapS: spec.wrapS ?? gl.CLAMP_TO_EDGE,
    wrapT: spec.wrapT ?? gl.CLAMP_TO_EDGE
  }));
}
