import { WebGLError, assertNotDisposed, isWebGLContext } from "../../core/src/index";
import type { GLContext } from "../../core/src/index";

export type BufferData = BufferSource | number;

export interface GLBufferOptions {
  target: number;
  usage?: number;
  data?: BufferData;
}

export class GLBuffer {
  public readonly gl: GLContext;
  public readonly buffer: WebGLBuffer;
  public readonly target: number;
  public usage: number;
  public byteLength = 0;

  private isDisposed = false;

  constructor(gl: GLContext, options: GLBufferOptions) {
    if (!isWebGLContext(gl)) {
      throw new TypeError("gl must be a WebGL rendering context.");
    }

    this.gl = gl;
    this.target = options.target;
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

  public get disposed(): boolean {
    return this.isDisposed;
  }

  public bind(): void {
    assertNotDisposed("GLBuffer", this.isDisposed);
    this.gl.bindBuffer(this.target, this.buffer);
  }

  public unbind(): void {
    this.gl.bindBuffer(this.target, null);
  }

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

  public dispose(): void {
    if (this.isDisposed) {
      return;
    }

    this.gl.deleteBuffer(this.buffer);
    this.isDisposed = true;
  }

  private captureBinding(): WebGLBuffer | null {
    if (this.target === this.gl.ARRAY_BUFFER) {
      return this.gl.getParameter(this.gl.ARRAY_BUFFER_BINDING) as WebGLBuffer | null;
    }

    if (this.target === this.gl.ELEMENT_ARRAY_BUFFER) {
      return this.gl.getParameter(this.gl.ELEMENT_ARRAY_BUFFER_BINDING) as WebGLBuffer | null;
    }

    return null;
  }
}
