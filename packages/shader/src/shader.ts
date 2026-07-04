import { WebGLError, assertNotDisposed, isWebGLContext } from "../../core/src/index";
import type { GLContext } from "../../core/src/index";

export interface ShaderOptions {
  type: number;
  source: string;
}

export class Shader {
  public readonly gl: GLContext;
  public readonly shader: WebGLShader;
  public readonly type: number;

  private isDisposed = false;

  constructor(gl: GLContext, options: ShaderOptions) {
    if (!isWebGLContext(gl)) {
      throw new TypeError("gl must be a WebGL rendering context.");
    }

    this.gl = gl;
    this.type = options.type;

    const shader = gl.createShader(options.type);
    if (shader === null) {
      throw new WebGLError("Failed to create shader.");
    }

    this.shader = shader;

    try {
      gl.shaderSource(shader, options.source);
      gl.compileShader(shader);

      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        throw new WebGLError(
          formatShaderCompileError(gl, options.type, gl.getShaderInfoLog(shader) ?? "", options.source)
        );
      }
    } catch (error) {
      gl.deleteShader(shader);
      throw error;
    }
  }

  public get disposed(): boolean {
    return this.isDisposed;
  }

  public assertUsable(): void {
    assertNotDisposed("Shader", this.isDisposed);
  }

  public dispose(): void {
    if (this.isDisposed) {
      return;
    }

    this.gl.deleteShader(this.shader);
    this.isDisposed = true;
  }
}

function shaderStageName(gl: GLContext, type: number): string {
  if (type === gl.VERTEX_SHADER) {
    return "vertex";
  }

  if (type === gl.FRAGMENT_SHADER) {
    return "fragment";
  }

  return "shader";
}

function parseErrorLine(log: string): number | null {
  const match = /ERROR:\s*\d+:(\d+):/.exec(log);
  if (match === null) {
    return null;
  }

  const line = Number.parseInt(match[1] ?? "", 10);
  return Number.isNaN(line) ? null : line;
}

function annotateSource(source: string, errorLine: number | null): string {
  const lines = source.split("\n");
  const width = String(lines.length).length;

  return lines
    .map((text, index) => {
      const number = index + 1;
      const marker = number === errorLine ? ">" : " ";
      return `${marker} ${String(number).padStart(width, " ")} | ${text}`;
    })
    .join("\n");
}

function formatShaderCompileError(
  gl: GLContext,
  type: number,
  log: string,
  source: string
): string {
  const stage = shaderStageName(gl, type);
  const detail = log.trim() === "" ? "Failed to compile shader." : log.trim();
  const annotated = annotateSource(source, parseErrorLine(log));
  return `Failed to compile ${stage} shader: ${detail}\n\n${annotated}`;
}
