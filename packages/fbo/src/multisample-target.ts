import {
  WebGLError,
  assertNotDisposed,
  assertPositiveIntegerDimension,
  isWebGL2,
  isWebGLContext,
  withSavedBindings as saveBindings
} from "../../core/src/index";
import type { GLContext } from "../../core/src/index";

/** Constructor options for {@link MultisampleTarget}. */
export interface MultisampleTargetOptions {
  /** Target width in pixels (positive integer). */
  width: number;
  /** Target height in pixels (positive integer). */
  height: number;
  /** Requested MSAA sample count; clamped to the context's `MAX_SAMPLES`. Defaults to 4. */
  samples?: number;
  /** Sized, color-renderable internal format for the multisampled color storage. Defaults to `RGBA8`. */
  internalFormat?: number;
  /** Resolve texture `TEXTURE_MIN_FILTER`. Defaults to `LINEAR`. */
  minFilter?: number;
  /** Resolve texture `TEXTURE_MAG_FILTER`. Defaults to `LINEAR`. */
  magFilter?: number;
  /** Resolve texture `TEXTURE_WRAP_S`. Defaults to `CLAMP_TO_EDGE`. */
  wrapS?: number;
  /** Resolve texture `TEXTURE_WRAP_T`. Defaults to `CLAMP_TO_EDGE`. */
  wrapT?: number;
  /** Attach a multisampled depth renderbuffer. Defaults to `false`. */
  depth?: boolean;
  /** Attach a multisampled depth-stencil renderbuffer. Defaults to `false`. */
  stencil?: boolean;
}

/** Options for {@link MultisampleTarget.resize}. */
export interface MultisampleTargetResizeOptions {
  /** New width in pixels (positive integer). */
  width: number;
  /** New height in pixels (positive integer). */
  height: number;
}

/** The minimal canvas shape read by {@link MultisampleTarget.resizeToCanvas}. */
export type MultisampleTargetCanvasSize = Pick<HTMLCanvasElement, "width" | "height">;

interface ResolveConfig {
  minFilter: number;
  magFilter: number;
  wrapS: number;
  wrapT: number;
}

/**
 * A WebGL2 multisampled (anti-aliased) off-screen target. Rendering goes into a
 * multisampled renderbuffer; call {@link MultisampleTarget.resolve} to blit it
 * into `texture`, which is then sampleable like any other texture.
 */
export class MultisampleTarget {
  /** The WebGL2 rendering context this target belongs to. */
  public readonly gl: WebGL2RenderingContext;
  /** The multisampled draw framebuffer (render into this). */
  public readonly framebuffer: WebGLFramebuffer;
  /** The single-sample framebuffer that {@link MultisampleTarget.resolve} blits into. */
  public readonly resolveFramebuffer: WebGLFramebuffer;
  /** The resolved, sampleable color texture. Valid after `resolve()`. */
  public readonly texture: WebGLTexture;
  /** The multisampled color renderbuffer backing `framebuffer`. */
  public readonly colorRenderbuffer: WebGLRenderbuffer;
  /** The multisampled depth/stencil renderbuffer, or `null` if not requested. */
  public readonly depthRenderbuffer: WebGLRenderbuffer | null;
  /** The actual sample count in use (requested value clamped to `MAX_SAMPLES`). */
  public readonly samples: number;
  /** Current width in pixels. Updated by {@link MultisampleTarget.resize}. */
  public width: number;
  /** Current height in pixels. Updated by {@link MultisampleTarget.resize}. */
  public height: number;

  private readonly colorFormat: number;
  private readonly stencil: boolean;
  private readonly resolveConfig: ResolveConfig;
  private isDisposed = false;

  /**
   * Allocate the multisampled draw framebuffer, the resolve framebuffer/texture,
   * and any depth/stencil storage, then verify both are complete. Restores prior
   * bindings.
   *
   * @throws {TypeError} if `gl` is not a WebGL rendering context, or the
   *   dimensions are not positive integers.
   * @throws {WebGLError} if `gl` is not WebGL2, allocation fails, or either
   *   framebuffer is incomplete.
   */
  constructor(gl: GLContext, options: MultisampleTargetOptions) {
    if (!isWebGLContext(gl)) {
      throw new TypeError("gl must be a WebGL rendering context.");
    }
    if (!isWebGL2(gl)) {
      throw new WebGLError("MultisampleTarget requires a WebGL2 context.");
    }

    this.gl = gl;
    this.width = assertPositiveIntegerDimension("width", options.width);
    this.height = assertPositiveIntegerDimension("height", options.height);
    this.stencil = options.stencil ?? false;
    this.colorFormat = options.internalFormat ?? gl.RGBA8;
    this.resolveConfig = {
      minFilter: options.minFilter ?? gl.LINEAR,
      magFilter: options.magFilter ?? gl.LINEAR,
      wrapS: options.wrapS ?? gl.CLAMP_TO_EDGE,
      wrapT: options.wrapT ?? gl.CLAMP_TO_EDGE
    };

    const maxSamples = gl.getParameter(gl.MAX_SAMPLES) as number;
    this.samples = Math.max(1, Math.min(options.samples ?? 4, maxSamples));

    const framebuffer = gl.createFramebuffer() as WebGLFramebuffer | null;
    if (framebuffer === null) {
      throw new WebGLError("Failed to create framebuffer.");
    }
    const resolveFramebuffer = gl.createFramebuffer() as WebGLFramebuffer | null;
    if (resolveFramebuffer === null) {
      gl.deleteFramebuffer(framebuffer);
      throw new WebGLError("Failed to create resolve framebuffer.");
    }
    const colorRenderbuffer = gl.createRenderbuffer() as WebGLRenderbuffer | null;
    if (colorRenderbuffer === null) {
      gl.deleteFramebuffer(framebuffer);
      gl.deleteFramebuffer(resolveFramebuffer);
      throw new WebGLError("Failed to create color renderbuffer.");
    }
    const texture = gl.createTexture() as WebGLTexture | null;
    if (texture === null) {
      gl.deleteFramebuffer(framebuffer);
      gl.deleteFramebuffer(resolveFramebuffer);
      gl.deleteRenderbuffer(colorRenderbuffer);
      throw new WebGLError("Failed to create resolve texture.");
    }

    this.framebuffer = framebuffer;
    this.resolveFramebuffer = resolveFramebuffer;
    this.colorRenderbuffer = colorRenderbuffer;
    this.texture = texture;
    this.depthRenderbuffer = null;

    try {
      if (options.depth === true || options.stencil === true) {
        const depthRenderbuffer = gl.createRenderbuffer() as WebGLRenderbuffer | null;
        if (depthRenderbuffer === null) {
          throw new WebGLError("Failed to create depth renderbuffer.");
        }
        this.depthRenderbuffer = depthRenderbuffer;
      }

      this.withSavedBindings(() => {
        this.configureDraw();
        this.configureResolve();
      });
    } catch (error) {
      gl.deleteFramebuffer(framebuffer);
      gl.deleteFramebuffer(resolveFramebuffer);
      gl.deleteRenderbuffer(colorRenderbuffer);
      if (this.depthRenderbuffer !== null) {
        gl.deleteRenderbuffer(this.depthRenderbuffer);
      }
      gl.deleteTexture(texture);
      throw error;
    }
  }

  /** Whether {@link MultisampleTarget.dispose} has been called. */
  public get disposed(): boolean {
    return this.isDisposed;
  }

  /** Bind the multisampled draw framebuffer for rendering. */
  public bind(): void {
    assertNotDisposed("MultisampleTarget", this.isDisposed);
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.framebuffer);
  }

  /** Unbind the framebuffer, restoring the default (bind `null`). */
  public unbind(): void {
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
  }

  /**
   * Bind the draw framebuffer, run `render`, then restore prior bindings. Call
   * {@link MultisampleTarget.resolve} afterwards before sampling `texture`.
   *
   * @returns whatever `render` returns.
   */
  public withBound<T>(render: () => T): T {
    return this.withSavedBindings(() => {
      this.bind();
      return render();
    });
  }

  /** Resolve the multisampled contents into `texture` (call before sampling). */
  public resolve(): void {
    assertNotDisposed("MultisampleTarget", this.isDisposed);
    const gl = this.gl;

    saveBindings(
      gl,
      [
        {
          binding: gl.READ_FRAMEBUFFER_BINDING,
          restore: (value) =>
            gl.bindFramebuffer(gl.READ_FRAMEBUFFER, value as WebGLFramebuffer | null)
        },
        {
          binding: gl.FRAMEBUFFER_BINDING,
          restore: (value) =>
            gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, value as WebGLFramebuffer | null)
        }
      ],
      () => {
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.framebuffer);
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.resolveFramebuffer);
        gl.blitFramebuffer(
          0,
          0,
          this.width,
          this.height,
          0,
          0,
          this.width,
          this.height,
          gl.COLOR_BUFFER_BIT,
          gl.NEAREST
        );
      }
    );
  }

  /**
   * Reallocate the color, depth, and resolve storage to a new size. On failure
   * the previous dimensions are restored.
   *
   * @throws {TypeError} if the dimensions are not positive integers.
   * @throws {WebGLError} if either resized framebuffer is incomplete.
   */
  public resize(options: MultisampleTargetResizeOptions): void {
    assertNotDisposed("MultisampleTarget", this.isDisposed);
    const previousWidth = this.width;
    const previousHeight = this.height;
    const nextWidth = assertPositiveIntegerDimension("width", options.width);
    const nextHeight = assertPositiveIntegerDimension("height", options.height);

    this.withSavedBindings(() => {
      this.width = nextWidth;
      this.height = nextHeight;

      try {
        this.allocateColorStorage();
        this.allocateResolveTexture();

        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.framebuffer);
        this.assertComplete("multisample draw");
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.resolveFramebuffer);
        this.assertComplete("multisample resolve");
      } catch (error) {
        this.width = previousWidth;
        this.height = previousHeight;
        throw error;
      }
    });
  }

  /** Resize to match a canvas's backing-store dimensions. */
  public resizeToCanvas(canvas: MultisampleTargetCanvasSize): void {
    this.resize({ width: canvas.width, height: canvas.height });
  }

  /**
   * Read the resolved RGBA pixels into a newly allocated `Uint8Array`. Call
   * {@link MultisampleTarget.resolve} first. Prefer
   * {@link MultisampleTarget.readPixelsInto} in a hot loop.
   */
  public readPixels(): Uint8Array {
    return this.readPixelsInto(new Uint8Array(this.width * this.height * 4));
  }

  /**
   * Read the resolved RGBA pixels into `out` (reused across frames). Call
   * {@link MultisampleTarget.resolve} first. Restores the prior read-framebuffer
   * binding.
   *
   * @throws {RangeError} if `out` is too small.
   * @returns the same `out` array.
   */
  public readPixelsInto(out: Uint8Array): Uint8Array {
    assertNotDisposed("MultisampleTarget", this.isDisposed);
    const gl = this.gl;
    const required = this.width * this.height * 4;
    if (out.length < required) {
      throw new RangeError(
        `Readback array must hold at least ${required} bytes, received ${out.length}.`
      );
    }

    saveBindings(
      gl,
      [
        {
          binding: gl.READ_FRAMEBUFFER_BINDING,
          restore: (value) =>
            gl.bindFramebuffer(gl.READ_FRAMEBUFFER, value as WebGLFramebuffer | null)
        }
      ],
      () => {
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.resolveFramebuffer);
        gl.readBuffer(gl.COLOR_ATTACHMENT0);
        gl.readPixels(0, 0, this.width, this.height, gl.RGBA, gl.UNSIGNED_BYTE, out);
      }
    );
    return out;
  }

  /**
   * Delete both framebuffers, the color/depth renderbuffers, and the resolve
   * texture. Idempotent.
   */
  public dispose(): void {
    if (this.isDisposed) {
      return;
    }

    this.gl.deleteFramebuffer(this.framebuffer);
    this.gl.deleteFramebuffer(this.resolveFramebuffer);
    this.gl.deleteRenderbuffer(this.colorRenderbuffer);
    if (this.depthRenderbuffer !== null) {
      this.gl.deleteRenderbuffer(this.depthRenderbuffer);
    }
    this.gl.deleteTexture(this.texture);

    this.isDisposed = true;
  }

  private configureDraw(): void {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    this.allocateColorStorage();
    gl.framebufferRenderbuffer(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.RENDERBUFFER,
      this.colorRenderbuffer
    );

    if (this.depthRenderbuffer !== null) {
      const attachment = this.stencil ? gl.DEPTH_STENCIL_ATTACHMENT : gl.DEPTH_ATTACHMENT;
      gl.framebufferRenderbuffer(
        gl.FRAMEBUFFER,
        attachment,
        gl.RENDERBUFFER,
        this.depthRenderbuffer
      );
    }

    gl.bindRenderbuffer(gl.RENDERBUFFER, null);
    this.assertComplete("multisample draw");
  }

  private configureResolve(): void {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.resolveFramebuffer);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, this.resolveConfig.minFilter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, this.resolveConfig.magFilter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, this.resolveConfig.wrapS);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, this.resolveConfig.wrapT);
    this.allocateResolveTexture();
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texture, 0);
    gl.bindTexture(gl.TEXTURE_2D, null);
    this.assertComplete("multisample resolve");
  }

  private allocateColorStorage(): void {
    const gl = this.gl;
    gl.bindRenderbuffer(gl.RENDERBUFFER, this.colorRenderbuffer);
    gl.renderbufferStorageMultisample(
      gl.RENDERBUFFER,
      this.samples,
      this.colorFormat,
      this.width,
      this.height
    );

    if (this.depthRenderbuffer !== null) {
      const format = this.stencil ? gl.DEPTH24_STENCIL8 : gl.DEPTH_COMPONENT24;
      gl.bindRenderbuffer(gl.RENDERBUFFER, this.depthRenderbuffer);
      gl.renderbufferStorageMultisample(
        gl.RENDERBUFFER,
        this.samples,
        format,
        this.width,
        this.height
      );
    }

    gl.bindRenderbuffer(gl.RENDERBUFFER, null);
  }

  private allocateResolveTexture(): void {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      this.width,
      this.height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null
    );
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  private assertComplete(label: string): void {
    const status = this.gl.checkFramebufferStatus(this.gl.FRAMEBUFFER);
    if (status !== this.gl.FRAMEBUFFER_COMPLETE) {
      throw new WebGLError(`${label} framebuffer is incomplete (status ${status}).`);
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
