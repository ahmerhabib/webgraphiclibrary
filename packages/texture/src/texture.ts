import {
  WebGLError,
  assertNotDisposed,
  assertPositiveIntegerDimension,
  isWebGLContext,
  withSavedBindings as saveBindings
} from "../../core/src/index";
import type { BindingSlot, GLContext } from "../../core/src/index";

/**
 * An image-like source accepted by {@link Texture2D.uploadImage} and the
 * `image` constructor option.
 */
export type TextureImageSource =
  HTMLImageElement | HTMLCanvasElement | HTMLVideoElement | ImageBitmap | ImageData;

export interface Texture2DOptions {
  width: number;
  height: number;
  internalFormat?: number;
  format?: number;
  type?: number;
  minFilter?: number;
  magFilter?: number;
  wrapS?: number;
  wrapT?: number;
  data?: ArrayBufferView | null;
  image?: TextureImageSource;
  flipY?: boolean;
  premultiplyAlpha?: boolean;
}

export interface TextureUploadOptions extends Partial<Texture2DOptions> {
  width: number;
  height: number;
}

interface TextureConfig {
  internalFormat: number;
  format: number;
  type: number;
  minFilter: number;
  magFilter: number;
  wrapS: number;
  wrapT: number;
  flipY: boolean;
  premultiplyAlpha: boolean;
}

export class Texture2D {
  public readonly gl: GLContext;
  public readonly texture: WebGLTexture;
  public width: number;
  public height: number;

  private readonly config: TextureConfig;
  private isDisposed = false;

  constructor(gl: GLContext, options: Texture2DOptions) {
    if (!isWebGLContext(gl)) {
      throw new TypeError("gl must be a WebGL rendering context.");
    }

    this.gl = gl;
    this.width = assertPositiveIntegerDimension("width", options.width);
    this.height = assertPositiveIntegerDimension("height", options.height);
    this.config = {
      internalFormat: options.internalFormat ?? gl.RGBA,
      format: options.format ?? gl.RGBA,
      type: options.type ?? gl.UNSIGNED_BYTE,
      minFilter: options.minFilter ?? gl.LINEAR,
      magFilter: options.magFilter ?? gl.LINEAR,
      wrapS: options.wrapS ?? gl.CLAMP_TO_EDGE,
      wrapT: options.wrapT ?? gl.CLAMP_TO_EDGE,
      flipY: options.flipY ?? false,
      premultiplyAlpha: options.premultiplyAlpha ?? false
    };

    const texture = gl.createTexture() as WebGLTexture | null;
    if (texture === null) {
      throw new WebGLError("Failed to create texture.");
    }

    this.texture = texture;

    try {
      this.withSavedBindings(() => {
        this.applySamplerParameters();

        if (options.image === undefined) {
          this.allocate(options.data ?? null);
        }
      });

      if (options.image !== undefined) {
        this.uploadImage(options.image);
      }
    } catch (error) {
      gl.deleteTexture(texture);
      throw error;
    }
  }

  public get disposed(): boolean {
    return this.isDisposed;
  }

  public bind(): void {
    assertNotDisposed("Texture2D", this.isDisposed);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
  }

  public unbind(): void {
    this.gl.bindTexture(this.gl.TEXTURE_2D, null);
  }

  public withBound<T>(render: () => T): T {
    assertNotDisposed("Texture2D", this.isDisposed);
    const gl = this.gl;

    return saveBindings(
      gl,
      [
        {
          binding: gl.TEXTURE_BINDING_2D,
          restore: (value) => gl.bindTexture(gl.TEXTURE_2D, value as WebGLTexture | null)
        }
      ],
      () => {
        this.bind();
        return render();
      }
    );
  }

  public upload(options: TextureUploadOptions): void {
    assertNotDisposed("Texture2D", this.isDisposed);
    const previousWidth = this.width;
    const previousHeight = this.height;
    const nextWidth = assertPositiveIntegerDimension("width", options.width);
    const nextHeight = assertPositiveIntegerDimension("height", options.height);

    this.withSavedBindings(() => {
      this.width = nextWidth;
      this.height = nextHeight;

      try {
        this.allocate(options.data ?? null);
      } catch (error) {
        this.width = previousWidth;
        this.height = previousHeight;
        throw error;
      }
    });
  }

  public uploadImage(source: TextureImageSource): void {
    assertNotDisposed("Texture2D", this.isDisposed);
    const gl = this.gl;

    saveBindings(
      gl,
      [
        {
          binding: gl.TEXTURE_BINDING_2D,
          restore: (value) => gl.bindTexture(gl.TEXTURE_2D, value as WebGLTexture | null)
        },
        {
          binding: gl.UNPACK_FLIP_Y_WEBGL,
          restore: (value) => gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, value ? 1 : 0)
        },
        {
          binding: gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,
          restore: (value) => gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, value ? 1 : 0)
        }
      ],
      () => {
        this.bind();
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, this.config.flipY ? 1 : 0);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, this.config.premultiplyAlpha ? 1 : 0);
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          this.config.internalFormat,
          this.config.format,
          this.config.type,
          source
        );

        const size = sourceSize(source);
        this.width = size.width;
        this.height = size.height;
      }
    );
  }

  public generateMipmap(): void {
    assertNotDisposed("Texture2D", this.isDisposed);

    this.withSavedBindings(() => {
      this.bind();
      this.gl.generateMipmap(this.gl.TEXTURE_2D);
    });
  }

  public dispose(): void {
    if (this.isDisposed) {
      return;
    }

    this.gl.deleteTexture(this.texture);
    this.isDisposed = true;
  }

  private applySamplerParameters(): void {
    this.bind();
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.config.minFilter);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.config.magFilter);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.config.wrapS);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.config.wrapT);
  }

  private allocate(data: ArrayBufferView | null): void {
    this.bind();
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.config.internalFormat,
      this.width,
      this.height,
      0,
      this.config.format,
      this.config.type,
      data
    );
  }

  private withSavedBindings<T>(operation: () => T): T {
    return saveBindings(this.gl, textureBindingSlots(this.gl), operation);
  }
}

export function readTexturePixels(gl: GLContext, texture: Texture2D): Uint8Array {
  return readTexturePixelsInto(gl, texture, new Uint8Array(texture.width * texture.height * 4));
}

/**
 * Read a texture's RGBA pixels into a caller-provided array through a
 * temporary framebuffer, avoiding a per-call allocation. The array must hold
 * at least `width * height * 4` bytes.
 */
export function readTexturePixelsInto(
  gl: GLContext,
  texture: Texture2D,
  out: Uint8Array
): Uint8Array {
  assertNotDisposed("Texture2D", texture.disposed);

  const required = texture.width * texture.height * 4;
  if (out.length < required) {
    throw new RangeError(
      `Readback array must hold at least ${required} bytes, received ${out.length}.`
    );
  }

  const framebuffer = gl.createFramebuffer() as WebGLFramebuffer | null;
  if (framebuffer === null) {
    throw new WebGLError("Failed to create texture readback framebuffer.");
  }

  return saveBindings(gl, textureBindingSlots(gl), () => {
    try {
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        texture.texture,
        0
      );

      const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
      if (status !== gl.FRAMEBUFFER_COMPLETE) {
        throw new WebGLError("Texture readback framebuffer is incomplete.");
      }

      gl.readPixels(0, 0, texture.width, texture.height, gl.RGBA, gl.UNSIGNED_BYTE, out);
      return out;
    } finally {
      gl.deleteFramebuffer(framebuffer);
    }
  });
}

function sourceSize(source: TextureImageSource): { width: number; height: number } {
  if ("videoWidth" in source) {
    return { width: source.videoWidth, height: source.videoHeight };
  }

  if ("naturalWidth" in source) {
    return { width: source.naturalWidth, height: source.naturalHeight };
  }

  return { width: source.width, height: source.height };
}

function textureBindingSlots(gl: GLContext): BindingSlot[] {
  return [
    {
      binding: gl.TEXTURE_BINDING_2D,
      restore: (value) => gl.bindTexture(gl.TEXTURE_2D, value as WebGLTexture | null)
    },
    {
      binding: gl.FRAMEBUFFER_BINDING,
      restore: (value) => gl.bindFramebuffer(gl.FRAMEBUFFER, value as WebGLFramebuffer | null)
    }
  ];
}
