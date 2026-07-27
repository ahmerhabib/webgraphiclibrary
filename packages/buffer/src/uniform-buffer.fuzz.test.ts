import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { UniformBuffer } from "./index";

type Call = [name: string, ...args: unknown[]];

function createMockGL2() {
  const calls: Call[] = [];
  const buffer = { type: "buffer" };
  let uniformBufferBinding: unknown = null;

  const gl = {
    calls,
    UNIFORM_BUFFER: 0x8a11,
    UNIFORM_BUFFER_BINDING: 0x8a28,
    DYNAMIC_DRAW: 0x88e8,
    STATIC_DRAW: 0x88e4,
    INVALID_INDEX: 0xffffffff,
    createFramebuffer: () => ({}),
    bindFramebuffer: () => undefined,
    checkFramebufferStatus: () => 0x8cd5,
    texStorage2D: () => undefined,
    createBuffer: () => buffer,
    bindBuffer: (target: number, value: unknown) => {
      if (target === gl.UNIFORM_BUFFER) uniformBufferBinding = value;
      calls.push(["bindBuffer", target, value]);
    },
    bufferData: (...args: unknown[]) => calls.push(["bufferData", ...args]),
    bufferSubData: (...args: unknown[]) => calls.push(["bufferSubData", ...args]),
    bindBufferBase: (...args: unknown[]) => calls.push(["bindBufferBase", ...args]),
    bindBufferRange: (...args: unknown[]) => calls.push(["bindBufferRange", ...args]),
    getParameter: (parameter: number) =>
      parameter === gl.UNIFORM_BUFFER_BINDING ? uniformBufferBinding : null,
    deleteBuffer: (...args: unknown[]) => calls.push(["deleteBuffer", ...args])
  } as unknown as WebGL2RenderingContext & { calls: Call[] };

  return gl;
}

// Property-based fuzzing of the UBO bounds validation: no combination of
// sizes and offsets may ever reach the driver with an out-of-bounds range.
describe("UniformBuffer bounds validation (fuzzed)", () => {
  it("update never forwards an out-of-bounds or invalid write to the GL", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1024 }),
        fc.integer({ min: 0, max: 256 }).map((n) => n * 4),
        fc.oneof(
          fc.integer({ min: -2048, max: 2048 }),
          fc.double({ min: -64, max: 64, noNaN: true })
        ),
        (byteLength, dataLength, byteOffset) => {
          const gl = createMockGL2();
          const ubo = new UniformBuffer(gl, { data: byteLength });
          const data = new Uint8Array(dataLength);

          const inBounds =
            Number.isInteger(byteOffset) &&
            byteOffset >= 0 &&
            byteOffset + dataLength <= byteLength;

          if (inBounds) {
            ubo.update(data, byteOffset);
            expect(gl.calls).toContainEqual(["bufferSubData", gl.UNIFORM_BUFFER, byteOffset, data]);
          } else {
            expect(() => ubo.update(data, byteOffset)).toThrow(RangeError);
            expect(gl.calls.some(([name]) => name === "bufferSubData")).toBe(false);
          }
        }
      )
    );
  });

  it("bindRange never forwards an out-of-bounds or invalid range to the GL", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1024 }),
        fc.integer({ min: -2048, max: 2048 }),
        fc.integer({ min: -2048, max: 2048 }),
        (byteLength, byteOffset, size) => {
          const gl = createMockGL2();
          const ubo = new UniformBuffer(gl, { data: byteLength });

          const valid = byteOffset >= 0 && size > 0 && byteOffset + size <= byteLength;

          if (valid) {
            ubo.bindRange(0, byteOffset, size);
            expect(gl.calls).toContainEqual([
              "bindBufferRange",
              gl.UNIFORM_BUFFER,
              0,
              ubo.buffer,
              byteOffset,
              size
            ]);
          } else {
            expect(() => ubo.bindRange(0, byteOffset, size)).toThrow(RangeError);
            expect(gl.calls.some(([name]) => name === "bindBufferRange")).toBe(false);
          }
        }
      )
    );
  });
});
