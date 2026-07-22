import {
  WebGLError,
  assertNotDisposed,
  isWebGL2,
  isWebGLContext,
  withSavedBindings as saveBindings
} from "../../core/src/index";
import type { GLContext } from "../../core/src/index";

/**
 * A WebGL2 vertex array object (VAO). Bind it while configuring vertex
 * attributes (for example via `Program.enableAttribute`) and the attribute
 * state — including the `ELEMENT_ARRAY_BUFFER` binding — is captured; binding
 * the VAO again restores all of it with one call. Call
 * {@link VertexArray.dispose} to free the GPU object.
 */
export class VertexArray {
  /** The WebGL2 rendering context this vertex array belongs to. */
  public readonly gl: WebGL2RenderingContext;
  /** The underlying `WebGLVertexArrayObject` handle. */
  public readonly vertexArray: WebGLVertexArrayObject;

  private isDisposed = false;

  /**
   * Create an empty vertex array object.
   *
   * @throws {TypeError} if `gl` is not a WebGL rendering context.
   * @throws {WebGLError} if `gl` is not WebGL2 or the vertex array cannot be
   *   created.
   */
  constructor(gl: GLContext) {
    if (!isWebGLContext(gl)) {
      throw new TypeError("gl must be a WebGL rendering context.");
    }
    if (!isWebGL2(gl)) {
      throw new WebGLError("VertexArray requires a WebGL2 context.");
    }

    this.gl = gl;

    const vertexArray = gl.createVertexArray() as WebGLVertexArrayObject | null;
    if (vertexArray === null) {
      throw new WebGLError("Failed to create vertex array.");
    }

    this.vertexArray = vertexArray;
  }

  /** Whether {@link VertexArray.dispose} has been called. */
  public get disposed(): boolean {
    return this.isDisposed;
  }

  /** Bind this vertex array, restoring its captured attribute state. */
  public bind(): void {
    assertNotDisposed("VertexArray", this.isDisposed);
    this.gl.bindVertexArray(this.vertexArray);
  }

  /** Unbind the vertex array (bind `null`). */
  public unbind(): void {
    this.gl.bindVertexArray(null);
  }

  /**
   * Bind this vertex array, run `render`, then restore the previously bound
   * vertex array. Use it both to record attribute state and to draw with it.
   *
   * @returns whatever `render` returns.
   */
  public withBound<T>(render: () => T): T {
    assertNotDisposed("VertexArray", this.isDisposed);
    const gl = this.gl;

    return saveBindings(
      gl,
      [
        {
          binding: gl.VERTEX_ARRAY_BINDING,
          restore: (value) => gl.bindVertexArray(value as WebGLVertexArrayObject | null)
        }
      ],
      () => {
        this.bind();
        return render();
      }
    );
  }

  /** Delete the vertex array. Idempotent. */
  public dispose(): void {
    if (this.isDisposed) {
      return;
    }

    this.gl.deleteVertexArray(this.vertexArray);
    this.isDisposed = true;
  }
}
