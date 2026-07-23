import { WebGLError, assertNotDisposed, isWebGL2, isWebGLContext } from "../../core/src/index";
import type { GLContext } from "../../core/src/index";

/**
 * Data accepted by {@link GLBuffer}: a `BufferSource` to upload, or a number of
 * bytes to allocate as uninitialized storage.
 */
export type BufferData = BufferSource | number;

/** Options for {@link GLBuffer}. */
export interface GLBufferOptions {
  /**
   * Bind target: `gl.ARRAY_BUFFER` or `gl.ELEMENT_ARRAY_BUFFER` (WebGL2 also
   * accepts the copy, pixel, transform-feedback, and uniform buffer targets).
   */
  target: number;
  /** Usage hint. Defaults to `gl.STATIC_DRAW`. */
  usage?: number;
  /** Initial data to upload, or a byte size to allocate. */
  data?: BufferData;
}

/**
 * Wraps a `WebGLBuffer` with typed uploads and partial updates. Every operation
 * saves and restores the previously bound buffer for its target.
 */
export class GLBuffer {
  /** The rendering context the buffer was created with. */
  public readonly gl: GLContext;
  /** The underlying `WebGLBuffer` handle. */
  public readonly buffer: WebGLBuffer;
  /** The bind target passed to the constructor. */
  public readonly target: number;
  /** The current usage hint. */
  public usage: number;
  /** Size in bytes of the most recent upload. */
  public byteLength = 0;

  private isDisposed = false;

  private readonly bindingParameter: number;

  /**
   * Create a buffer, optionally uploading initial data.
   * @throws {TypeError} if `gl` is not a WebGL rendering context.
   * @throws {WebGLError} if `target` is not a valid buffer target for this
   *   context, or the buffer cannot be created.
   */
  constructor(gl: GLContext, options: GLBufferOptions) {
    if (!isWebGLContext(gl)) {
      throw new TypeError("gl must be a WebGL rendering context.");
    }

    const bindingParameter = bindingParameterForTarget(gl, options.target);
    if (bindingParameter === undefined) {
      throw new WebGLError(`Unsupported buffer target ${options.target} for this context.`);
    }

    this.gl = gl;
    this.target = options.target;
    this.bindingParameter = bindingParameter;
    this.usage = options.usage ?? gl.STATIC_DRAW;

    const buffer = gl.createBuffer() as WebGLBuffer | null;
    if (buffer === null) {
      throw new WebGLError("Failed to create buffer.");
    }

    this.buffer = buffer;

    if (options.data !== undefined) {
      try {
        this.upload(options.data, this.usage);
      } catch (error) {
        gl.deleteBuffer(buffer);
        throw error;
      }
    }
  }

  /** Whether {@link GLBuffer.dispose} has been called. */
  public get disposed(): boolean {
    return this.isDisposed;
  }

  /** Bind this buffer to its target. */
  public bind(): void {
    assertNotDisposed("GLBuffer", this.isDisposed);
    this.gl.bindBuffer(this.target, this.buffer);
  }

  /** Unbind this buffer's target (bind `null`). */
  public unbind(): void {
    this.gl.bindBuffer(this.target, null);
  }

  /**
   * Bind the buffer, run `render`, then restore the previously bound buffer.
   * @returns whatever `render` returns.
   */
  public withBound<T>(render: () => T): T {
    assertNotDisposed("GLBuffer", this.isDisposed);
    const previous = this.captureBinding();

    try {
      this.bind();
      return render();
    } finally {
      this.gl.bindBuffer(this.target, previous);
    }
  }

  /**
   * Reallocate the buffer's storage with new data (a `BufferSource`) or a byte
   * size (a number). Updates {@link GLBuffer.byteLength} and restores the
   * previous binding.
   */
  public upload(data: BufferData, usage = this.usage): void {
    assertNotDisposed("GLBuffer", this.isDisposed);
    this.usage = usage;

    const previous = this.captureBinding();

    try {
      this.bind();

      // `bufferData` is overloaded: a numeric argument allocates that many
      // bytes of uninitialized storage, while a BufferSource uploads data.
      // The branches narrow the `number | BufferSource` union so TypeScript
      // resolves the intended overload in each case.
      if (typeof data === "number") {
        this.gl.bufferData(this.target, data, usage);
        this.byteLength = data;
      } else {
        this.gl.bufferData(this.target, data, usage);
        this.byteLength = data.byteLength;
      }
    } finally {
      this.gl.bindBuffer(this.target, previous);
    }
  }

  /**
   * Overwrite part of the buffer via `bufferSubData`, without reallocating.
   * @throws {RangeError} if `offsetBytes` is negative or non-integer, or the
   * write would extend past {@link GLBuffer.byteLength}.
   */
  public updateSubData(offsetBytes: number, data: BufferSource): void {
    assertNotDisposed("GLBuffer", this.isDisposed);

    if (!Number.isInteger(offsetBytes) || offsetBytes < 0) {
      throw new RangeError("offsetBytes must be a non-negative integer.");
    }

    if (offsetBytes + data.byteLength > this.byteLength) {
      throw new RangeError(
        `Sub-data update of ${data.byteLength} bytes at offset ${offsetBytes} exceeds the buffer length of ${this.byteLength} bytes.`
      );
    }

    const previous = this.captureBinding();

    try {
      this.bind();
      this.gl.bufferSubData(this.target, offsetBytes, data);
    } finally {
      this.gl.bindBuffer(this.target, previous);
    }
  }

  /** Delete the buffer. Idempotent — safe to call more than once. */
  public dispose(): void {
    if (this.isDisposed) {
      return;
    }

    this.gl.deleteBuffer(this.buffer);
    this.isDisposed = true;
  }

  private captureBinding(): WebGLBuffer | null {
    return this.gl.getParameter(this.bindingParameter) as WebGLBuffer | null;
  }
}

function bindingParameterForTarget(gl: GLContext, target: number): number | undefined {
  if (target === gl.ARRAY_BUFFER) {
    return gl.ARRAY_BUFFER_BINDING;
  }
  if (target === gl.ELEMENT_ARRAY_BUFFER) {
    return gl.ELEMENT_ARRAY_BUFFER_BINDING;
  }

  if (isWebGL2(gl)) {
    switch (target) {
      case gl.COPY_READ_BUFFER:
        return gl.COPY_READ_BUFFER_BINDING;
      case gl.COPY_WRITE_BUFFER:
        return gl.COPY_WRITE_BUFFER_BINDING;
      case gl.PIXEL_PACK_BUFFER:
        return gl.PIXEL_PACK_BUFFER_BINDING;
      case gl.PIXEL_UNPACK_BUFFER:
        return gl.PIXEL_UNPACK_BUFFER_BINDING;
      case gl.TRANSFORM_FEEDBACK_BUFFER:
        return gl.TRANSFORM_FEEDBACK_BUFFER_BINDING;
      case gl.UNIFORM_BUFFER:
        return gl.UNIFORM_BUFFER_BINDING;
    }
  }

  return undefined;
}
