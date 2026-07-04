import { describe, expect, it } from "vitest";
import { Program } from "./index";

type Call = [name: string, ...args: unknown[]];

function createMockGL(overrides: Record<string, unknown> = {}) {
  const calls: Call[] = [];
  const program = { type: "program" };
  const vertexShader = { type: "vertex-shader" };
  const fragmentShader = { type: "fragment-shader" };
  const uniform = { type: "uniform" };
  const attrib = 7;
  let currentProgram: unknown = null;
  let arrayBufferBinding: unknown = null;

  const gl = {
    calls,
    LINK_STATUS: 0x8b82,
    CURRENT_PROGRAM: 0x8b8d,
    ARRAY_BUFFER: 0x8892,
    ARRAY_BUFFER_BINDING: 0x8894,
    FLOAT: 0x1406,
    SHORT: 0x1402,
    createFramebuffer: () => ({}),
    bindFramebuffer: () => undefined,
    checkFramebufferStatus: () => 0x8cd5,
    createProgram: () => program,
    attachShader: (...args: unknown[]) => calls.push(["attachShader", ...args]),
    linkProgram: (...args: unknown[]) => calls.push(["linkProgram", ...args]),
    getProgramParameter: () => true,
    getProgramInfoLog: () => "",
    useProgram: (program: unknown) => {
      currentProgram = program;
      calls.push(["useProgram", program]);
    },
    getParameter: (parameter: number) => {
      if (parameter === gl.CURRENT_PROGRAM) {
        return currentProgram;
      }

      if (parameter === gl.ARRAY_BUFFER_BINDING) {
        return arrayBufferBinding;
      }

      return null;
    },
    getUniformLocation: (...args: unknown[]) => {
      calls.push(["getUniformLocation", ...args]);
      return uniform;
    },
    getAttribLocation: () => attrib,
    bindBuffer: (target: number, value: unknown) => {
      if (target === gl.ARRAY_BUFFER) {
        arrayBufferBinding = value;
      }

      calls.push(["bindBuffer", target, value]);
    },
    enableVertexAttribArray: (...args: unknown[]) =>
      calls.push(["enableVertexAttribArray", ...args]),
    vertexAttribPointer: (...args: unknown[]) => calls.push(["vertexAttribPointer", ...args]),
    uniform1f: (...args: unknown[]) => calls.push(["uniform1f", ...args]),
    uniform2f: (...args: unknown[]) => calls.push(["uniform2f", ...args]),
    uniform3f: (...args: unknown[]) => calls.push(["uniform3f", ...args]),
    uniform4f: (...args: unknown[]) => calls.push(["uniform4f", ...args]),
    uniform1i: (...args: unknown[]) => calls.push(["uniform1i", ...args]),
    uniform1fv: (...args: unknown[]) => calls.push(["uniform1fv", ...args]),
    uniform2fv: (...args: unknown[]) => calls.push(["uniform2fv", ...args]),
    uniform3fv: (...args: unknown[]) => calls.push(["uniform3fv", ...args]),
    uniform4fv: (...args: unknown[]) => calls.push(["uniform4fv", ...args]),
    uniformMatrix2fv: (...args: unknown[]) => calls.push(["uniformMatrix2fv", ...args]),
    uniformMatrix3fv: (...args: unknown[]) => calls.push(["uniformMatrix3fv", ...args]),
    uniformMatrix4fv: (...args: unknown[]) => calls.push(["uniformMatrix4fv", ...args]),
    activeTexture: (...args: unknown[]) => calls.push(["activeTexture", ...args]),
    bindTexture: (...args: unknown[]) => calls.push(["bindTexture", ...args]),
    TEXTURE0: 0x84c0,
    TEXTURE_2D: 0x0de1,
    deleteProgram: (...args: unknown[]) => calls.push(["deleteProgram", ...args]),
    vertexShader,
    fragmentShader,
    ...overrides
  } as unknown as WebGLRenderingContext & {
    calls: Call[];
    vertexShader: WebGLShader;
    fragmentShader: WebGLShader;
  };

  return gl;
}

describe("Program", () => {
  it("rejects a non-WebGL rendering context", () => {
    const gl = createMockGL();
    expect(
      () =>
        new Program({} as unknown as WebGLRenderingContext, {
          vertexShader: gl.vertexShader,
          fragmentShader: gl.fragmentShader
        })
    ).toThrow("gl must be a WebGL rendering context.");
  });

  it("links vertex and fragment shaders into a program", () => {
    const gl = createMockGL();
    const program = new Program(gl, {
      vertexShader: gl.vertexShader,
      fragmentShader: gl.fragmentShader
    });

    program.use();

    expect(program.program).toBeTruthy();
    expect(gl.calls.filter(([name]) => name === "attachShader")).toHaveLength(2);
    expect(gl.calls.some(([name]) => name === "linkProgram")).toBe(true);
    expect(gl.calls.at(-1)).toEqual(["useProgram", program.program]);
  });

  it("deletes the program when linking fails", () => {
    const gl = createMockGL({
      getProgramParameter: () => false,
      getProgramInfoLog: () => "link failed"
    });

    expect(
      () => new Program(gl, { vertexShader: gl.vertexShader, fragmentShader: gl.fragmentShader })
    ).toThrow("link failed");
    expect(gl.calls.filter(([name]) => name === "deleteProgram")).toHaveLength(1);
  });

  it("prefixes link failures with a program message", () => {
    const gl = createMockGL({
      getProgramParameter: () => false,
      getProgramInfoLog: () => "bad varying"
    });

    const make = () =>
      new Program(gl, { vertexShader: gl.vertexShader, fragmentShader: gl.fragmentShader });

    expect(make).toThrow("Failed to link program");
    expect(make).toThrow("bad varying");
  });

  it("resolves uniforms and attributes with descriptive errors", () => {
    const gl = createMockGL({
      getUniformLocation: () => null,
      getAttribLocation: () => -1
    });
    const program = new Program(gl, {
      vertexShader: gl.vertexShader,
      fragmentShader: gl.fragmentShader
    });

    expect(() => program.getUniformLocation("missingUniform")).toThrow("missingUniform");
    expect(() => program.getAttribLocation("missingAttribute")).toThrow("missingAttribute");
  });

  it("uses the program within withUsed and restores the previous program", () => {
    const gl = createMockGL();
    const previous = { type: "previous-program" };
    gl.useProgram(previous);
    const program = new Program(gl, {
      vertexShader: gl.vertexShader,
      fragmentShader: gl.fragmentShader
    });

    let usedDuringCallback: unknown;
    const result = program.withUsed(() => {
      usedDuringCallback = gl.getParameter(gl.CURRENT_PROGRAM);
      return "ok";
    });

    expect(usedDuringCallback).toBe(program.program);
    expect(result).toBe("ok");
    expect(gl.getParameter(gl.CURRENT_PROGRAM)).toBe(previous);
  });

  it("restores the previous program when withUsed throws", () => {
    const gl = createMockGL();
    const previous = { type: "previous-program" };
    gl.useProgram(previous);
    const program = new Program(gl, {
      vertexShader: gl.vertexShader,
      fragmentShader: gl.fragmentShader
    });

    expect(() =>
      program.withUsed(() => {
        throw new Error("boom");
      })
    ).toThrow("boom");
    expect(gl.getParameter(gl.CURRENT_PROGRAM)).toBe(previous);
  });

  it("caches uniform locations and looks them up once", () => {
    const gl = createMockGL();
    const program = new Program(gl, {
      vertexShader: gl.vertexShader,
      fragmentShader: gl.fragmentShader
    });

    const first = program.tryGetUniformLocation("color");
    const second = program.tryGetUniformLocation("color");

    expect(first).toBe(second);
    expect(gl.calls.filter(([name]) => name === "getUniformLocation")).toHaveLength(1);
  });

  it("returns null from tryGetUniformLocation for missing uniforms without throwing", () => {
    const gl = createMockGL({ getUniformLocation: () => null });
    const program = new Program(gl, {
      vertexShader: gl.vertexShader,
      fragmentShader: gl.fragmentShader
    });

    expect(program.tryGetUniformLocation("missing")).toBeNull();
  });

  it("no-ops uniform setters when the location is missing", () => {
    const gl = createMockGL({ getUniformLocation: () => null });
    const program = new Program(gl, {
      vertexShader: gl.vertexShader,
      fragmentShader: gl.fragmentShader
    });

    expect(() => program.setUniform1f("missing", 1)).not.toThrow();
    expect(gl.calls).toContainEqual(["uniform1f", null, 1]);
  });

  const uniformSetters: Array<{
    glCall: string;
    apply: (program: Program) => Program;
    expected: readonly unknown[];
  }> = [
    { glCall: "uniform1f", apply: (p) => p.setUniform1f("u", 1.5), expected: [1.5] },
    { glCall: "uniform2f", apply: (p) => p.setUniform2f("u", 1, 2), expected: [1, 2] },
    { glCall: "uniform3f", apply: (p) => p.setUniform3f("u", 1, 2, 3), expected: [1, 2, 3] },
    { glCall: "uniform4f", apply: (p) => p.setUniform4f("u", 1, 2, 3, 4), expected: [1, 2, 3, 4] },
    { glCall: "uniform1i", apply: (p) => p.setUniform1i("u", 7), expected: [7] },
    {
      glCall: "uniform1fv",
      apply: (p) => p.setUniform1fv("u", new Float32Array([1])),
      expected: [new Float32Array([1])]
    },
    {
      glCall: "uniform2fv",
      apply: (p) => p.setUniform2fv("u", new Float32Array([1, 2])),
      expected: [new Float32Array([1, 2])]
    },
    {
      glCall: "uniform3fv",
      apply: (p) => p.setUniform3fv("u", new Float32Array([1, 2, 3])),
      expected: [new Float32Array([1, 2, 3])]
    },
    {
      glCall: "uniform4fv",
      apply: (p) => p.setUniform4fv("u", new Float32Array([1, 2, 3, 4])),
      expected: [new Float32Array([1, 2, 3, 4])]
    },
    {
      glCall: "uniformMatrix2fv",
      apply: (p) => p.setUniformMatrix2fv("u", new Float32Array(4)),
      expected: [false, new Float32Array(4)]
    },
    {
      glCall: "uniformMatrix3fv",
      apply: (p) => p.setUniformMatrix3fv("u", new Float32Array(9)),
      expected: [false, new Float32Array(9)]
    },
    {
      glCall: "uniformMatrix4fv",
      apply: (p) => p.setUniformMatrix4fv("u", new Float32Array(16)),
      expected: [false, new Float32Array(16)]
    }
  ];

  it.each(uniformSetters)(
    "$glCall applies the value and returns the program for chaining",
    ({ glCall, apply, expected }) => {
      const gl = createMockGL();
      const program = new Program(gl, {
        vertexShader: gl.vertexShader,
        fragmentShader: gl.fragmentShader
      });
      const location = gl.getUniformLocation(program.program, "u");

      const returned = apply(program);

      expect(returned).toBe(program);
      expect(gl.calls).toContainEqual([glCall, location, ...expected]);
    }
  );

  it("binds a raw texture to a unit and sets the sampler uniform", () => {
    const gl = createMockGL();
    const program = new Program(gl, {
      vertexShader: gl.vertexShader,
      fragmentShader: gl.fragmentShader
    });
    const location = gl.getUniformLocation(program.program, "source");
    const handle = { type: "raw-texture" } as unknown as WebGLTexture;

    const returned = program.setTexture("source", handle, 2);

    expect(returned).toBe(program);
    expect(gl.calls).toContainEqual(["activeTexture", gl.TEXTURE0 + 2]);
    expect(gl.calls).toContainEqual(["bindTexture", gl.TEXTURE_2D, handle]);
    expect(gl.calls).toContainEqual(["uniform1i", location, 2]);
  });

  it("unwraps a Texture2D-like wrapper in setTexture", () => {
    const gl = createMockGL();
    const program = new Program(gl, {
      vertexShader: gl.vertexShader,
      fragmentShader: gl.fragmentShader
    });
    const handle = { type: "raw-texture" } as unknown as WebGLTexture;

    program.setTexture("source", { texture: handle }, 0);

    expect(gl.calls).toContainEqual(["bindTexture", gl.TEXTURE_2D, handle]);
  });

  it("enables a vertex attribute from a buffer layout", () => {
    const gl = createMockGL();
    const program = new Program(gl, {
      vertexShader: gl.vertexShader,
      fragmentShader: gl.fragmentShader
    });
    const buffer = { type: "buffer" } as unknown as WebGLBuffer;

    const returned = program.enableAttribute("position", { buffer, size: 2 });

    expect(returned).toBe(program);
    expect(gl.calls).toContainEqual(["bindBuffer", gl.ARRAY_BUFFER, buffer]);
    expect(gl.calls).toContainEqual(["enableVertexAttribArray", 7]);
    expect(gl.calls).toContainEqual(["vertexAttribPointer", 7, 2, gl.FLOAT, false, 0, 0]);
  });

  it("applies custom layout options and unwraps a GLBuffer-like wrapper", () => {
    const gl = createMockGL();
    const program = new Program(gl, {
      vertexShader: gl.vertexShader,
      fragmentShader: gl.fragmentShader
    });
    const handle = { type: "buffer-handle" } as unknown as WebGLBuffer;

    program.enableAttribute("uv", {
      buffer: { buffer: handle },
      size: 2,
      type: gl.SHORT,
      normalized: true,
      stride: 16,
      offset: 8
    });

    expect(gl.calls).toContainEqual(["bindBuffer", gl.ARRAY_BUFFER, handle]);
    expect(gl.calls).toContainEqual(["vertexAttribPointer", 7, 2, gl.SHORT, true, 16, 8]);
  });

  it("restores the previous ARRAY_BUFFER binding after enableAttribute", () => {
    const gl = createMockGL();
    const previous = { type: "previous-array-buffer" };
    gl.bindBuffer(gl.ARRAY_BUFFER, previous);
    const program = new Program(gl, {
      vertexShader: gl.vertexShader,
      fragmentShader: gl.fragmentShader
    });

    program.enableAttribute("position", {
      buffer: { type: "buffer" },
      size: 3
    });

    expect(gl.getParameter(gl.ARRAY_BUFFER_BINDING)).toBe(previous);
  });

  it("sets an attribute divisor for instancing when supported", () => {
    const divisorCalls: unknown[][] = [];
    const gl = createMockGL({
      vertexAttribDivisor: (...args: unknown[]) => divisorCalls.push(args)
    });
    const program = new Program(gl, {
      vertexShader: gl.vertexShader,
      fragmentShader: gl.fragmentShader
    });

    program.enableAttribute("offset", {
      buffer: { type: "buffer" },
      size: 2,
      divisor: 1
    });

    expect(divisorCalls).toContainEqual([7, 1]);
  });

  it("throws when a divisor is requested without WebGL2 support", () => {
    const gl = createMockGL();
    const program = new Program(gl, {
      vertexShader: gl.vertexShader,
      fragmentShader: gl.fragmentShader
    });

    expect(() =>
      program.enableAttribute("offset", {
        buffer: { type: "buffer" },
        size: 2,
        divisor: 1
      })
    ).toThrow("WebGL2");
  });

  it("disposes once and rejects use after disposal", () => {
    const gl = createMockGL();
    const program = new Program(gl, {
      vertexShader: gl.vertexShader,
      fragmentShader: gl.fragmentShader
    });

    program.dispose();
    program.dispose();

    expect(program.disposed).toBe(true);
    expect(gl.calls.filter(([name]) => name === "deleteProgram")).toHaveLength(1);
    expect(() => program.use()).toThrow("Program has been disposed.");
  });
});
