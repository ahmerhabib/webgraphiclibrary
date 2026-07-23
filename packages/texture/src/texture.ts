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

/** Options for {@link Texture2D}. */
export interface Texture2DOptions {
  /** Width in pixels (positive integer). */
  width: number;
  /** Height in pixels (positive integer). */
  height: number;
  /** Internal format. Defaults to `gl.RGBA`. */
  internalFormat?: number;
  /** Data format. Defaults to `gl.RGBA`. */
  format?: number;
  /** Data type. Defaults to `gl.UNSIGNED_BYTE`. */
  type?: number;
  /** Minification filter. Defaults to `gl.LINEAR`. */
  minFilter?: number;
  /** Magnification filter. Defaults to `gl.LINEAR`. */
  magFilter?: number;
  /** Horizontal wrap mode. Defaults to `gl.CLAMP_TO_EDGE`. */
  wrapS?: number;
  /** Vertical wrap mode. Defaults to `gl.CLAMP_TO_EDGE`. */
  wrapT?: number;
  /** Initial pixel data. Defaults to `null` (uninitialized storage). */
  data?: ArrayBufferView | null;
  /** Upload from an image source at construction instead of allocating empty storage. */
  image?: TextureImageSource;
  /** Set `UNPACK_FLIP_Y_WEBGL` for image uploads. Defaults to `false`. */
  flipY?: boolean;
  /** Set `UNPACK_PREMULTIPLY_ALPHA_WEBGL` for image uploads. Defaults to `false`. */
  premultiplyAlpha?: boolean;
}

/**
 * Options for {@link Texture2D.upload}: the new dimensions plus optional pixel
 * data. Formats, types, and filters are fixed at construction and cannot be
 * changed by an upload.
 */
export interface TextureUploadOptions {
  /** New width in pixels (positive integer). */
  width: number;
  /** New height in pixels (positive integer). */
  height: number;
  /** Pixel data matching the texture's construction-time format, or `null` for empty storage. */
  data?: ArrayBufferView | null;
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

/**
 * Allocates and uploads a 2D texture from typed-array data or an image source
 * (image, canvas, video, `ImageBitmap`, `ImageData`), with mipmap generation
 * and pixel-store options. Bindings are saved and restored around every upload.
 */
export class Texture2D {
  /** The rendering context the texture was created with. */
  public readonly gl: GLContext;
  /** The underlying `WebGLTexture` handle. */
  public readonly texture: WebGLTexture;
  /** Current width in pixels (tracks the last upload). */
  public width: number;
  /** Current height in pixels (tracks the last upload). */
  public height: number;

  private readonly config: TextureConfig;
  private isDisposed = false;

  /**
   * Create a texture, optionally allocating storage or uploading an image.
   * @throws {TypeError} if `gl` is not a WebGL rendering context.
   * @throws {RangeError | TypeError} for invalid dimensions.
   * @throws {WebGLError} if the texture cannot be created.
   */
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

  /** Whether {@link Texture2D.dispose} has been called. */
  public get disposed(): boolean {
    return this.isDisposed;
  }

  /** Bind this texture to `TEXTURE_2D`. */
  public bind(): void {
    assertNotDisposed("Texture2D", this.isDisposed);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
  }

  /** Unbind `TEXTURE_2D` (bind `null`). */
  public unbind(): void {
    this.gl.bindTexture(this.gl.TEXTURE_2D, null);
  }

  /**
   * Bind this texture, run `render`, then restore the previously bound texture.
   * @returns whatever `render` returns.
   */
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

  /** Reallocate the texture from typed-array data (or empty storage), updating its size. */
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

  /**
   * Upload from an image source (image, canvas, video, `ImageBitmap`,
   * `ImageData`), applying `flipY`/`premultiplyAlpha` and tracking the source's
   * size. Restores the previous texture binding and pixel-store state.
   *
   * @throws {RangeError} if the source has a zero dimension (for example an
   *   image or video that has not finished loading).
   */
  public uploadImage(source: TextureImageSource): void {
    assertNotDisposed("Texture2D", this.isDisposed);
    const gl = this.gl;

    const size = sourceSize(source);
    if (size.width <= 0 || size.height <= 0) {
      throw new RangeError("Image source has a zero dimension — it may not have finished loading.");
    }

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

        this.width = size.width;
        this.height = size.height;
      }
    );
  }

  /** Generate a mipmap chain for the texture. Restores the previous binding. */
  public generateMipmap(): void {
    assertNotDisposed("Texture2D", this.isDisposed);

    this.withSavedBindings(() => {
      this.bind();
      this.gl.generateMipmap(this.gl.TEXTURE_2D);
    });
  }

  /** Delete the texture. Idempotent. */
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
    const gl = this.gl;

    return saveBindings(
      gl,
      [
        {
          binding: gl.TEXTURE_BINDING_2D,
          restore: (value) => gl.bindTexture(gl.TEXTURE_2D, value as WebGLTexture | null)
        }
      ],
      operation
    );
  }
}

/**
 * Read a texture's RGBA pixels into a newly allocated `Uint8Array` through a
 * temporary framebuffer. Prefer {@link readTexturePixelsInto} in a hot loop.
 */
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

  return saveBindings(gl, readbackBindingSlots(gl), () => {
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

function readbackBindingSlots(gl: GLContext): BindingSlot[] {
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
