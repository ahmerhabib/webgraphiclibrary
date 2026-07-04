import {
  WebGLError,
  assertNotDisposed,
  assertPositiveIntegerDimension,
  getFramebufferStatusMessage,
  isWebGL2,
  isWebGLContext,
  withSavedBindings as saveBindings
} from "../../core/src/index";
import type { GLContext } from "../../core/src/index";

export interface FramebufferOptions {
  width: number;
  height: number;
  internalFormat?: number;
  format?: number;
  type?: number;
  minFilter?: number;
  magFilter?: number;
  wrapS?: number;
  wrapT?: number;
  depth?: boolean;
  stencil?: boolean;
}

export interface FramebufferResizeOptions {
  width: number;
  height: number;
}

export type FramebufferCanvasSize = Pick<HTMLCanvasElement, "width" | "height">;

type TextureOptions = Required<
  Pick<
    FramebufferOptions,
    "internalFormat" | "format" | "type" | "minFilter" | "magFilter" | "wrapS" | "wrapT"
  >
> &
  Required<Pick<FramebufferOptions, "depth" | "stencil">>;

export class Framebuffer {
  public readonly gl: GLContext;
  public readonly framebuffer: WebGLFramebuffer;
  public readonly texture: WebGLTexture;
  public readonly renderbuffer: WebGLRenderbuffer | null;
  public width: number;
  public height: number;

  private readonly options: TextureOptions;
  private isDisposed = false;

  constructor(gl: GLContext, options: FramebufferOptions) {
    if (!isWebGLContext(gl)) {
      throw new TypeError("gl must be a WebGL rendering context.");
    }

    this.gl = gl;
    this.width = assertPositiveIntegerDimension("width", options.width);
    this.height = assertPositiveIntegerDimension("height", options.height);
    this.options = {
      internalFormat: options.internalFormat ?? gl.RGBA,
      format: options.format ?? gl.RGBA,
      type: options.type ?? gl.UNSIGNED_BYTE,
      minFilter: options.minFilter ?? gl.LINEAR,
      magFilter: options.magFilter ?? gl.LINEAR,
      wrapS: options.wrapS ?? gl.CLAMP_TO_EDGE,
      wrapT: options.wrapT ?? gl.CLAMP_TO_EDGE,
      depth: options.depth ?? false,
      stencil: options.stencil ?? false
    };

    const framebuffer = gl.createFramebuffer() as WebGLFramebuffer | null;
    const texture = gl.createTexture() as WebGLTexture | null;

    if (framebuffer === null) {
      throw new WebGLError("Failed to create framebuffer.");
    }

    if (texture === null) {
      gl.deleteFramebuffer(framebuffer);
      throw new WebGLError("Failed to create framebuffer texture.");
    }

    this.framebuffer = framebuffer;
    this.texture = texture;
    this.renderbuffer = null;

    try {
      this.enableFloatRenderTarget();
      this.renderbuffer = this.createRenderbuffer();
      this.withSavedBindings(() => {
        this.configureAttachments();
        this.assertComplete();
      });
    } catch (error) {
      gl.deleteFramebuffer(framebuffer);
      gl.deleteTexture(texture);

      if (this.renderbuffer !== null) {
        gl.deleteRenderbuffer(this.renderbuffer);
      }

      throw error;
    }
  }

  public get disposed(): boolean {
    return this.isDisposed;
  }

  public bind(): void {
    assertNotDisposed("Framebuffer", this.isDisposed);
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.framebuffer);
  }

  public unbind(): void {
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
  }

  public withBound<T>(render: () => T): T {
    return this.withSavedBindings(() => {
      this.bind();
      return render();
    });
  }

  public resize(options: FramebufferResizeOptions): void {
    assertNotDisposed("Framebuffer", this.isDisposed);
    const previousWidth = this.width;
    const previousHeight = this.height;
    const nextWidth = assertPositiveIntegerDimension("width", options.width);
    const nextHeight = assertPositiveIntegerDimension("height", options.height);

    this.withSavedBindings(() => {
      this.width = nextWidth;
      this.height = nextHeight;

      try {
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.framebuffer);
        this.allocateTextureStorage();

        if (this.renderbuffer !== null) {
          this.allocateRenderbufferStorage();
        }

        this.assertComplete();
      } catch (error) {
        this.width = previousWidth;
        this.height = previousHeight;
        throw error;
      }
    });
  }

  public resizeToCanvas(canvas: FramebufferCanvasSize): void {
    this.resize({ width: canvas.width, height: canvas.height });
  }

  public readPixels(): Uint8Array {
    return this.readPixelsInto(new Uint8Array(this.width * this.height * 4));
  }

  /**
   * Read RGBA pixels into a caller-provided array, avoiding a per-call
   * allocation. The array must hold at least `width * height * 4` bytes.
   */
  public readPixelsInto(out: Uint8Array): Uint8Array {
    assertNotDisposed("Framebuffer", this.isDisposed);

    if (this.options.format !== this.gl.RGBA || this.options.type !== this.gl.UNSIGNED_BYTE) {
      throw new WebGLError("readPixels currently supports RGBA UNSIGNED_BYTE framebuffers only.");
    }

    const required = this.width * this.height * 4;
    if (out.length < required) {
      throw new RangeError(
        `Readback array must hold at least ${required} bytes, received ${out.length}.`
      );
    }

    this.withSavedBindings(() => {
      this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.framebuffer);
      this.gl.readPixels(
        0,
        0,
        this.width,
        this.height,
        this.options.format,
        this.options.type,
        out
      );
    });
    return out;
  }

  /**
   * Hint (WebGL2) that the given attachments' contents are no longer needed,
   * letting the driver skip storing them. Defaults to the color attachment
   * plus any depth/stencil attachment. No-op targets throw on WebGL1.
   */
  public invalidate(attachments?: readonly number[]): void {
    assertNotDisposed("Framebuffer", this.isDisposed);
    const gl = this.gl;

    if (!("invalidateFramebuffer" in gl)) {
      throw new WebGLError("invalidateFramebuffer requires a WebGL2 context.");
    }

    const targets = attachments ?? this.defaultInvalidateAttachments();

    this.withSavedBindings(() => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
      gl.invalidateFramebuffer(gl.FRAMEBUFFER, targets as number[]);
    });
  }

  public dispose(): void {
    if (this.isDisposed) {
      return;
    }

    this.gl.deleteFramebuffer(this.framebuffer);
    this.gl.deleteTexture(this.texture);

    if (this.renderbuffer !== null) {
      this.gl.deleteRenderbuffer(this.renderbuffer);
    }

    this.isDisposed = true;
  }

  private defaultInvalidateAttachments(): number[] {
    const gl = this.gl;
    const attachments: number[] = [gl.COLOR_ATTACHMENT0];

    if (this.renderbuffer !== null) {
      attachments.push(
        this.options.stencil ? gl.DEPTH_STENCIL_ATTACHMENT : gl.DEPTH_ATTACHMENT
      );
    }

    return attachments;
  }

  private enableFloatRenderTarget(): void {
    const gl = this.gl;
    const type = this.options.type;
    const halfFloat = "HALF_FLOAT" in gl ? gl.HALF_FLOAT : 0x8d61;

    if (type !== gl.FLOAT && type !== halfFloat) {
      return;
    }

    if (isWebGL2(gl)) {
      gl.getExtension("EXT_color_buffer_float");
    } else if (type === gl.FLOAT) {
      gl.getExtension("OES_texture_float");
      gl.getExtension("WEBGL_color_buffer_float");
    } else {
      gl.getExtension("OES_texture_half_float");
      gl.getExtension("EXT_color_buffer_half_float");
    }
  }

  private createRenderbuffer(): WebGLRenderbuffer | null {
    if (!this.options.depth && !this.options.stencil) {
      return null;
    }

    const renderbuffer = this.gl.createRenderbuffer() as WebGLRenderbuffer | null;
    if (renderbuffer === null) {
      throw new WebGLError("Failed to create framebuffer renderbuffer.");
    }

    return renderbuffer;
  }

  private configureAttachments(): void {
    const gl = this.gl;

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, this.options.minFilter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, this.options.magFilter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, this.options.wrapS);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, this.options.wrapT);
    this.allocateTextureStorage();
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texture, 0);

    if (this.renderbuffer !== null) {
      this.allocateRenderbufferStorage();
    }
  }

  private allocateTextureStorage(): void {
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.options.internalFormat,
      this.width,
      this.height,
      0,
      this.options.format,
      this.options.type,
      null
    );
    this.gl.bindTexture(this.gl.TEXTURE_2D, null);
  }

  private allocateRenderbufferStorage(): void {
    if (this.renderbuffer === null) {
      return;
    }

    const attachment = this.options.stencil
      ? this.gl.DEPTH_STENCIL_ATTACHMENT
      : this.gl.DEPTH_ATTACHMENT;
    const storage = this.options.stencil ? this.gl.DEPTH_STENCIL : this.gl.DEPTH_COMPONENT16;

    this.gl.bindRenderbuffer(this.gl.RENDERBUFFER, this.renderbuffer);
    this.gl.renderbufferStorage(this.gl.RENDERBUFFER, storage, this.width, this.height);
    this.gl.framebufferRenderbuffer(
      this.gl.FRAMEBUFFER,
      attachment,
      this.gl.RENDERBUFFER,
      this.renderbuffer
    );
    this.gl.bindRenderbuffer(this.gl.RENDERBUFFER, null);
  }

  private assertComplete(): void {
    const status = this.gl.checkFramebufferStatus(this.gl.FRAMEBUFFER);

    if (status !== this.gl.FRAMEBUFFER_COMPLETE) {
      throw new WebGLError(getFramebufferStatusMessage(this.gl, status));
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
