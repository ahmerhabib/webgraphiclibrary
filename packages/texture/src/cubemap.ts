import {
  WebGLError,
  assertNotDisposed,
  assertPositiveIntegerDimension,
  isWebGLContext,
  withSavedBindings as saveBindings
} from "../../core/src/index";
import type { GLContext } from "../../core/src/index";
import { sourceSize } from "./texture";
import type { TextureImageSource } from "./texture";

/**
 * The six cubemap faces in WebGL attachment order:
 * `+X`, `-X`, `+Y`, `-Y`, `+Z`, `-Z`. Face `i` maps to
 * `gl.TEXTURE_CUBE_MAP_POSITIVE_X + i`.
 */
export type CubemapFaceIndex = 0 | 1 | 2 | 3 | 4 | 5;

/** Options for {@link CubemapTexture}. */
export interface CubemapTextureOptions {
  /** Edge length in pixels of each square face (positive integer). */
  size: number;
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
  /**
   * Per-face pixel data in `+X, -X, +Y, -Y, +Z, -Z` order. Each entry may be
   * `null` for uninitialized storage. Defaults to six empty faces.
   */
  data?: readonly (ArrayBufferView | null)[];
  /**
   * Per-face image sources in `+X, -X, +Y, -Y, +Z, -Z` order, uploaded at
   * construction instead of allocating empty storage. All six must share the
   * cubemap's `size`.
   */
  faces?: readonly TextureImageSource[];
  /** Set `UNPACK_FLIP_Y_WEBGL` for image uploads. Defaults to `false`. */
  flipY?: boolean;
  /** Set `UNPACK_PREMULTIPLY_ALPHA_WEBGL` for image uploads. Defaults to `false`. */
  premultiplyAlpha?: boolean;
}

interface CubemapConfig {
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
 * A cube texture (`TEXTURE_CUBE_MAP`) for skyboxes, environment maps, and
 * reflections: six square faces allocated together, uploaded from typed-array
 * data or image sources, with the same state-restoration guarantees as
 * {@link Texture2D}. Sample it in GLSL with `samplerCube`.
 */
export class CubemapTexture {
  /** The rendering context the cubemap was created with. */
  public readonly gl: GLContext;
  /** The underlying `WebGLTexture` handle. */
  public readonly texture: WebGLTexture;
  /** Edge length in pixels of each square face. */
  public readonly size: number;

  private readonly config: CubemapConfig;
  private isDisposed = false;

  /**
   * Create the cubemap and allocate (or upload) all six faces.
   * @throws {TypeError} if `gl` is not a WebGL rendering context.
   * @throws {RangeError | TypeError} for an invalid `size`, or if `data` or
   *   `faces` does not hold exactly six entries.
   * @throws {WebGLError} if the texture cannot be created.
   */
  constructor(gl: GLContext, options: CubemapTextureOptions) {
    if (!isWebGLContext(gl)) {
      throw new TypeError("gl must be a WebGL rendering context.");
    }

    this.gl = gl;
    this.size = assertPositiveIntegerDimension("size", options.size);
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

    if (options.data !== undefined && options.data.length !== 6) {
      throw new RangeError(`Cubemap data must hold 6 faces, received ${options.data.length}.`);
    }
    if (options.faces !== undefined && options.faces.length !== 6) {
      throw new RangeError(`Cubemap faces must hold 6 sources, received ${options.faces.length}.`);
    }

    const texture = gl.createTexture() as WebGLTexture | null;
    if (texture === null) {
      throw new WebGLError("Failed to create cubemap texture.");
    }

    this.texture = texture;

    try {
      this.withSavedBindings(() => {
        this.applySamplerParameters();

        if (options.faces === undefined) {
          for (let face = 0; face < 6; face += 1) {
            this.allocateFace(face, options.data?.[face] ?? null);
          }
        }
      });

      if (options.faces !== undefined) {
        for (let face = 0; face < 6; face += 1) {
          this.uploadFace(face as CubemapFaceIndex, options.faces[face] as TextureImageSource);
        }
      }
    } catch (error) {
      gl.deleteTexture(texture);
      throw error;
    }
  }

  /** Whether {@link CubemapTexture.dispose} has been called. */
  public get disposed(): boolean {
    return this.isDisposed;
  }

  /** Bind this texture to `TEXTURE_CUBE_MAP`. */
  public bind(): void {
    assertNotDisposed("CubemapTexture", this.isDisposed);
    this.gl.bindTexture(this.gl.TEXTURE_CUBE_MAP, this.texture);
  }

  /** Unbind `TEXTURE_CUBE_MAP` (bind `null`). */
  public unbind(): void {
    this.gl.bindTexture(this.gl.TEXTURE_CUBE_MAP, null);
  }

  /**
   * Bind this cubemap, run `render`, then restore the previously bound cubemap.
   * @returns whatever `render` returns.
   */
  public withBound<T>(render: () => T): T {
    assertNotDisposed("CubemapTexture", this.isDisposed);

    return this.withSavedBindings(() => {
      this.bind();
      return render();
    });
  }

  /**
   * Upload one face from an image source (image, canvas, video, `ImageBitmap`,
   * `ImageData`), applying `flipY`/`premultiplyAlpha`. Restores the previous
   * cubemap binding and pixel-store state.
   *
   * @throws {RangeError} if `face` is not `0–5`, or the source is not a square
   *   image matching the cubemap's `size` (a zero dimension usually means the
   *   image has not finished loading).
   */
  public uploadFace(face: CubemapFaceIndex, source: TextureImageSource): void {
    assertNotDisposed("CubemapTexture", this.isDisposed);
    const gl = this.gl;
    assertFaceIndex(face);

    const size = sourceSize(source);
    if (size.width !== this.size || size.height !== this.size) {
      throw new RangeError(
        `Cubemap face ${face} must be ${this.size}×${this.size}, received ${size.width}×${size.height}.`
      );
    }

    saveBindings(
      gl,
      [
        {
          binding: gl.TEXTURE_BINDING_CUBE_MAP,
          restore: (value) => gl.bindTexture(gl.TEXTURE_CUBE_MAP, value as WebGLTexture | null)
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
          gl.TEXTURE_CUBE_MAP_POSITIVE_X + face,
          0,
          this.config.internalFormat,
          this.config.format,
          this.config.type,
          source
        );
      }
    );
  }

  /**
   * Reallocate one face from typed-array data (or `null` for empty storage).
   * The data must match the cubemap's construction-time format and `size`.
   * Restores the previous cubemap binding.
   *
   * @throws {RangeError} if `face` is not `0–5`.
   */
  public uploadFaceData(face: CubemapFaceIndex, data: ArrayBufferView | null): void {
    assertNotDisposed("CubemapTexture", this.isDisposed);
    assertFaceIndex(face);

    this.withSavedBindings(() => {
      this.allocateFace(face, data);
    });
  }

  /** Generate a mipmap chain for all faces. Restores the previous binding. */
  public generateMipmap(): void {
    assertNotDisposed("CubemapTexture", this.isDisposed);

    this.withSavedBindings(() => {
      this.bind();
      this.gl.generateMipmap(this.gl.TEXTURE_CUBE_MAP);
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
    const gl = this.gl;
    this.bind();
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, this.config.minFilter);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, this.config.magFilter);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, this.config.wrapS);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, this.config.wrapT);
  }

  private allocateFace(face: number, data: ArrayBufferView | null): void {
    const gl = this.gl;
    this.bind();
    gl.texImage2D(
      gl.TEXTURE_CUBE_MAP_POSITIVE_X + face,
      0,
      this.config.internalFormat,
      this.size,
      this.size,
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
          binding: gl.TEXTURE_BINDING_CUBE_MAP,
          restore: (value) => gl.bindTexture(gl.TEXTURE_CUBE_MAP, value as WebGLTexture | null)
        }
      ],
      operation
    );
  }
}

function assertFaceIndex(face: number): void {
  if (!Number.isInteger(face) || face < 0 || face > 5) {
    throw new RangeError(`Cubemap face index must be an integer 0–5, received ${face}.`);
  }
}
