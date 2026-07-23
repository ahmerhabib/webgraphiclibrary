import {
  WebGLError,
  assertNotDisposed,
  isWebGL2,
  isWebGLContext,
  withSavedBindings as saveBindings
} from "../../core/src/index";
import type { GLContext } from "../../core/src/index";
import type { BufferData } from "./buffer";

/**
 * A program accepted by {@link UniformBuffer.connect}: a raw `WebGLProgram` or
 * any object exposing one (such as `Program`), keeping this module decoupled
 * from the program package.
 */
export type UniformBufferProgram = WebGLProgram | { readonly program: WebGLProgram };

/** Constructor options for {@link UniformBuffer}. */
export interface UniformBufferOptions {
  /** Initial data to upload, or a byte size to allocate. */
  data: BufferData;
  /** Usage hint. Defaults to `gl.DYNAMIC_DRAW` (uniform data changes often). */
  usage?: number;
}

/**
 * A WebGL2 uniform buffer object (UBO). Holds a `std140` uniform block that
 * many programs can share through an indexed binding point: allocate, wire a
 * program's block to a binding index with {@link UniformBuffer.connect}, attach
 * the buffer there with {@link UniformBuffer.bindTo}, and stream per-frame
 * values with {@link UniformBuffer.update}. Every upload saves and restores the
 * previous `UNIFORM_BUFFER` binding.
 */
export class UniformBuffer {
  /** The WebGL2 rendering context this buffer belongs to. */
  public readonly gl: WebGL2RenderingContext;
  /** The underlying `WebGLBuffer` handle. */
  public readonly buffer: WebGLBuffer;
  /** The current usage hint. */
  public readonly usage: number;
  /** Allocated size in bytes. */
  public readonly byteLength: number;

  private isDisposed = false;

  /**
   * Create the buffer and allocate its storage.
   *
   * @throws {TypeError} if `gl` is not a WebGL rendering context.
   * @throws {WebGLError} if `gl` is not WebGL2 or the buffer cannot be created.
   */
  constructor(gl: GLContext, options: UniformBufferOptions) {
    if (!isWebGLContext(gl)) {
      throw new TypeError("gl must be a WebGL rendering context.");
    }
    if (!isWebGL2(gl)) {
      throw new WebGLError("UniformBuffer requires a WebGL2 context.");
    }

    this.gl = gl;
    this.usage = options.usage ?? gl.DYNAMIC_DRAW;

    const buffer = gl.createBuffer() as WebGLBuffer | null;
    if (buffer === null) {
      throw new WebGLError("Failed to create buffer.");
    }
    this.buffer = buffer;

    const data = options.data;
    this.byteLength = typeof data === "number" ? data : data.byteLength;

    try {
      this.withSavedBinding(() => {
        gl.bindBuffer(gl.UNIFORM_BUFFER, buffer);
        // `bufferData` is overloaded: a numeric argument allocates that many
        // bytes of uninitialized storage, while a BufferSource uploads data.
        // The branches narrow the `number | BufferSource` union so TypeScript
        // resolves the intended overload in each case.
        if (typeof data === "number") {
          gl.bufferData(gl.UNIFORM_BUFFER, data, this.usage);
        } else {
          gl.bufferData(gl.UNIFORM_BUFFER, data, this.usage);
        }
      });
    } catch (error) {
      gl.deleteBuffer(buffer);
      throw error;
    }
  }

  /** Whether {@link UniformBuffer.dispose} has been called. */
  public get disposed(): boolean {
    return this.isDisposed;
  }

  /**
   * Overwrite part of the buffer with `data` at `byteOffset`. Restores the
   * previous `UNIFORM_BUFFER` binding.
   *
   * @throws {RangeError} if `byteOffset` is negative or non-integer, or the
   *   write would run past the allocated size.
   */
  public update(data: BufferSource, byteOffset = 0): void {
    assertNotDisposed("UniformBuffer", this.isDisposed);

    if (!Number.isInteger(byteOffset) || byteOffset < 0) {
      throw new RangeError("byteOffset must be a non-negative integer.");
    }

    if (byteOffset + data.byteLength > this.byteLength) {
      throw new RangeError(
        `Update of ${String(data.byteLength)} bytes at offset ${String(byteOffset)} exceeds the buffer's ${String(this.byteLength)} bytes.`
      );
    }

    const gl = this.gl;
    this.withSavedBinding(() => {
      gl.bindBuffer(gl.UNIFORM_BUFFER, this.buffer);
      gl.bufferSubData(gl.UNIFORM_BUFFER, byteOffset, data as ArrayBufferView);
    });
  }

  /** Attach the whole buffer to the indexed uniform binding point `index`. */
  public bindTo(index: number): void {
    assertNotDisposed("UniformBuffer", this.isDisposed);
    this.gl.bindBufferBase(this.gl.UNIFORM_BUFFER, index, this.buffer);
  }

  /**
   * Attach `size` bytes starting at `byteOffset` to binding point `index`.
   *
   * @throws {RangeError} if `byteOffset` is negative or non-integer, `size` is
   *   not a positive integer, or the range runs past the allocated size.
   */
  public bindRange(index: number, byteOffset: number, size: number): void {
    assertNotDisposed("UniformBuffer", this.isDisposed);

    if (!Number.isInteger(byteOffset) || byteOffset < 0) {
      throw new RangeError("byteOffset must be a non-negative integer.");
    }
    if (!Number.isInteger(size) || size <= 0) {
      throw new RangeError("size must be a positive integer.");
    }
    if (byteOffset + size > this.byteLength) {
      throw new RangeError(
        `Range of ${String(size)} bytes at offset ${String(byteOffset)} exceeds the buffer's ${String(this.byteLength)} bytes.`
      );
    }

    this.gl.bindBufferRange(this.gl.UNIFORM_BUFFER, index, this.buffer, byteOffset, size);
  }

  /**
   * Wire `program`'s uniform block named `blockName` to binding point `index`
   * (call {@link UniformBuffer.bindTo} with the same index to supply the data).
   * Returns `this` for chaining.
   *
   * @throws {WebGLError} if the program has no uniform block with that name.
   */
  public connect(program: UniformBufferProgram, blockName: string, index: number): this {
    assertNotDisposed("UniformBuffer", this.isDisposed);
    const gl = this.gl;
    const handle = unwrapProgram(program);

    const blockIndex = gl.getUniformBlockIndex(handle, blockName);
    if (blockIndex === gl.INVALID_INDEX) {
      throw new WebGLError(`Uniform block "${blockName}" was not found.`);
    }

    gl.uniformBlockBinding(handle, blockIndex, index);
    return this;
  }

  /** Delete the buffer. Idempotent. */
  public dispose(): void {
    if (this.isDisposed) {
      return;
    }

    this.gl.deleteBuffer(this.buffer);
    this.isDisposed = true;
  }

  private withSavedBinding<T>(operation: () => T): T {
    const gl = this.gl;

    return saveBindings(
      gl,
      [
        {
          binding: gl.UNIFORM_BUFFER_BINDING,
          restore: (value) => gl.bindBuffer(gl.UNIFORM_BUFFER, value as WebGLBuffer | null)
        }
      ],
      operation
    );
  }
}

function unwrapProgram(program: UniformBufferProgram): WebGLProgram {
  const wrapper = program as { readonly program?: WebGLProgram };
  return wrapper.program ?? program;
}
