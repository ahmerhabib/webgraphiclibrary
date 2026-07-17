import {
  WebGLError,
  assertNotDisposed,
  isWebGLContext,
  withSavedBindings as saveBindings
} from "../../core/src/index";
import type { GLContext } from "../../core/src/index";
import type { Shader } from "../../shader/src/index";

/**
 * A shader accepted by {@link ProgramOptions}: either a raw `WebGLShader` handle
 * or a wrapped {@link Shader}, keeping this module decoupled from the shader
 * package.
 */
export type ProgramShader = WebGLShader | Shader;

/**
 * A texture accepted by {@link Program.setTexture}: either a raw
 * `WebGLTexture` handle or any object exposing one (such as `Texture2D`),
 * keeping this module decoupled from the texture package.
 */
export type ProgramTexture = WebGLTexture | { readonly texture: WebGLTexture };

/**
 * A buffer accepted by {@link Program.enableAttribute}: a raw `WebGLBuffer`
 * or any object exposing one (such as `GLBuffer`).
 */
export type ProgramBuffer = WebGLBuffer | { readonly buffer: WebGLBuffer };

/** Vertex attribute pointer layout for {@link Program.enableAttribute}. */
export interface AttributeLayout {
  buffer: ProgramBuffer;
  size: number;
  type?: number;
  normalized?: boolean;
  stride?: number;
  offset?: number;
  divisor?: number;
}

/** Constructor options for {@link Program}. */
export interface ProgramOptions {
  /** Vertex shader — a raw `WebGLShader` or a wrapped {@link Shader}. */
  vertexShader: ProgramShader;
  /** Fragment shader — a raw `WebGLShader` or a wrapped {@link Shader}. */
  fragmentShader: ProgramShader;
}

/**
 * A linked WebGL program (vertex + fragment shader). Wraps `createProgram`,
 * caches uniform locations, and exposes typed uniform/attribute setters and
 * texture binding. Call {@link Program.dispose} to free the GPU program.
 */
export class Program {
  /** The rendering context this program belongs to. */
  public readonly gl: GLContext;
  /** The underlying `WebGLProgram` handle. */
  public readonly program: WebGLProgram;

  private isDisposed = false;
  private readonly uniformLocations = new Map<string, WebGLUniformLocation | null>();

  /**
   * Create and link a program from a vertex and fragment shader.
   *
   * @throws {TypeError} if `gl` is not a WebGL rendering context.
   * @throws {WebGLError} if the program cannot be created or fails to link.
   */
  constructor(gl: GLContext, options: ProgramOptions) {
    if (!isWebGLContext(gl)) {
      throw new TypeError("gl must be a WebGL rendering context.");
    }

    this.gl = gl;

    const program = gl.createProgram() as WebGLProgram | null;
    if (program === null) {
      throw new WebGLError("Failed to create program.");
    }

    this.program = program;

    try {
      gl.attachShader(program, unwrapShader(options.vertexShader));
      gl.attachShader(program, unwrapShader(options.fragmentShader));
      gl.linkProgram(program);

      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        const log = (gl.getProgramInfoLog(program) ?? "").trim();
        throw new WebGLError(
          log === "" ? "Failed to link program." : `Failed to link program: ${log}`
        );
      }
    } catch (error) {
      gl.deleteProgram(program);
      throw error;
    }
  }

  /** Whether {@link Program.dispose} has been called. */
  public get disposed(): boolean {
    return this.isDisposed;
  }

  /** Make this the active program (`useProgram`). */
  public use(): void {
    assertNotDisposed("Program", this.isDisposed);
    this.gl.useProgram(this.program);
  }

  /**
   * Activate this program, run `run`, then restore the previously active
   * program.
   *
   * @returns whatever `run` returns.
   */
  public withUsed<T>(run: () => T): T {
    assertNotDisposed("Program", this.isDisposed);
    const gl = this.gl;

    return saveBindings(
      gl,
      [
        {
          binding: gl.CURRENT_PROGRAM,
          restore: (value) => gl.useProgram(value as WebGLProgram | null)
        }
      ],
      () => {
        this.use();
        return run();
      }
    );
  }

  /**
   * Resolve and cache a uniform location, returning `null` when the uniform is
   * not present (for example when it is optimized out of the linked program).
   */
  public tryGetUniformLocation(name: string): WebGLUniformLocation | null {
    assertNotDisposed("Program", this.isDisposed);

    const cached = this.uniformLocations.get(name);
    if (cached !== undefined) {
      return cached;
    }

    const location = this.gl.getUniformLocation(this.program, name);
    this.uniformLocations.set(name, location);
    return location;
  }

  /**
   * Resolve a uniform location, throwing if it is not present. Prefer
   * {@link Program.tryGetUniformLocation} when a missing uniform is acceptable.
   *
   * @throws {WebGLError} if the uniform is not found.
   */
  public getUniformLocation(name: string): WebGLUniformLocation {
    const location = this.tryGetUniformLocation(name);

    if (location === null) {
      throw new WebGLError(`Uniform "${name}" was not found.`);
    }

    return location;
  }

  /** Set a `float` uniform. Returns `this` for chaining. */
  public setUniform1f(name: string, x: number): this {
    this.gl.uniform1f(this.tryGetUniformLocation(name), x);
    return this;
  }

  /** Set a `vec2` uniform. Returns `this` for chaining. */
  public setUniform2f(name: string, x: number, y: number): this {
    this.gl.uniform2f(this.tryGetUniformLocation(name), x, y);
    return this;
  }

  /** Set a `vec3` uniform. Returns `this` for chaining. */
  public setUniform3f(name: string, x: number, y: number, z: number): this {
    this.gl.uniform3f(this.tryGetUniformLocation(name), x, y, z);
    return this;
  }

  /** Set a `vec4` uniform. Returns `this` for chaining. */
  public setUniform4f(name: string, x: number, y: number, z: number, w: number): this {
    this.gl.uniform4f(this.tryGetUniformLocation(name), x, y, z, w);
    return this;
  }

  /** Set an `int`/`sampler` uniform. Returns `this` for chaining. */
  public setUniform1i(name: string, x: number): this {
    this.gl.uniform1i(this.tryGetUniformLocation(name), x);
    return this;
  }

  /** Set a `float[]` uniform. Returns `this` for chaining. */
  public setUniform1fv(name: string, values: Float32List): this {
    this.gl.uniform1fv(this.tryGetUniformLocation(name), values);
    return this;
  }

  /** Set a `vec2[]` uniform. Returns `this` for chaining. */
  public setUniform2fv(name: string, values: Float32List): this {
    this.gl.uniform2fv(this.tryGetUniformLocation(name), values);
    return this;
  }

  /** Set a `vec3[]` uniform. Returns `this` for chaining. */
  public setUniform3fv(name: string, values: Float32List): this {
    this.gl.uniform3fv(this.tryGetUniformLocation(name), values);
    return this;
  }

  /** Set a `vec4[]` uniform. Returns `this` for chaining. */
  public setUniform4fv(name: string, values: Float32List): this {
    this.gl.uniform4fv(this.tryGetUniformLocation(name), values);
    return this;
  }

  /** Set a `mat2` uniform. Returns `this` for chaining. */
  public setUniformMatrix2fv(name: string, values: Float32List, transpose = false): this {
    this.gl.uniformMatrix2fv(this.tryGetUniformLocation(name), transpose, values);
    return this;
  }

  /** Set a `mat3` uniform. Returns `this` for chaining. */
  public setUniformMatrix3fv(name: string, values: Float32List, transpose = false): this {
    this.gl.uniformMatrix3fv(this.tryGetUniformLocation(name), transpose, values);
    return this;
  }

  /** Set a `mat4` uniform. Returns `this` for chaining. */
  public setUniformMatrix4fv(name: string, values: Float32List, transpose = false): this {
    this.gl.uniformMatrix4fv(this.tryGetUniformLocation(name), transpose, values);
    return this;
  }

  /**
   * Bind `texture` to `unit` and point the `name` sampler uniform at it. The
   * program must be in use (see {@link Program.withUsed}).
   */
  public setTexture(name: string, texture: ProgramTexture, unit: number): this {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, unwrapTexture(texture));
    gl.uniform1i(this.tryGetUniformLocation(name), unit);
    return this;
  }

  /**
   * Resolve a vertex attribute's location.
   *
   * @throws {WebGLError} if the attribute is not found (index `< 0`).
   */
  public getAttribLocation(name: string): number {
    assertNotDisposed("Program", this.isDisposed);
    const location = this.gl.getAttribLocation(this.program, name);

    if (location < 0) {
      throw new WebGLError(`Attribute "${name}" was not found.`);
    }

    return location;
  }

  /**
   * Bind `layout.buffer`, enable the `name` attribute, and configure its
   * vertex pointer. The `ARRAY_BUFFER` binding is restored afterwards. Pass
   * `divisor` for instanced attributes (WebGL2 only).
   */
  public enableAttribute(name: string, layout: AttributeLayout): this {
    const gl = this.gl;
    const location = this.getAttribLocation(name);

    saveBindings(
      gl,
      [
        {
          binding: gl.ARRAY_BUFFER_BINDING,
          restore: (value) => gl.bindBuffer(gl.ARRAY_BUFFER, value as WebGLBuffer | null)
        }
      ],
      () => {
        gl.bindBuffer(gl.ARRAY_BUFFER, unwrapBuffer(layout.buffer));
        gl.enableVertexAttribArray(location);
        gl.vertexAttribPointer(
          location,
          layout.size,
          layout.type ?? gl.FLOAT,
          layout.normalized ?? false,
          layout.stride ?? 0,
          layout.offset ?? 0
        );

        if (layout.divisor !== undefined) {
          if (!("vertexAttribDivisor" in gl)) {
            throw new WebGLError("Instanced attributes (divisor) require a WebGL2 context.");
          }

          gl.vertexAttribDivisor(location, layout.divisor);
        }
      }
    );

    return this;
  }

  /** Delete the program. Idempotent. */
  public dispose(): void {
    if (this.isDisposed) {
      return;
    }

    this.gl.deleteProgram(this.program);
    this.isDisposed = true;
  }
}

function unwrapShader(shader: ProgramShader): WebGLShader {
  return "shader" in shader ? shader.shader : shader;
}

function unwrapTexture(texture: ProgramTexture): WebGLTexture {
  const wrapper = texture as { readonly texture?: WebGLTexture };
  return wrapper.texture ?? texture;
}

function unwrapBuffer(buffer: ProgramBuffer): WebGLBuffer {
  const wrapper = buffer as { readonly buffer?: WebGLBuffer };
  return wrapper.buffer ?? buffer;
}
