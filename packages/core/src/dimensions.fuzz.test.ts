import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { assertPositiveIntegerDimension } from "./dimensions";

// Property-based fuzzing of the dimension validator: it guards every sizing
// path in the library, so it must hold for the entire double range.
describe("assertPositiveIntegerDimension (fuzzed)", () => {
  it("returns every positive integer unchanged", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 2 ** 31 - 1 }), (value) => {
        expect(assertPositiveIntegerDimension("width", value)).toBe(value);
      })
    );
  });

  it("throws TypeError for every non-integer double", () => {
    fc.assert(
      fc.property(
        fc.double({ noNaN: false, noDefaultInfinity: false }).filter((v) => !Number.isInteger(v)),
        (value) => {
          expect(() => assertPositiveIntegerDimension("height", value)).toThrow(TypeError);
        }
      )
    );
  });

  it("throws RangeError for every non-positive integer", () => {
    fc.assert(
      fc.property(fc.integer({ min: -(2 ** 31), max: 0 }), (value) => {
        expect(() => assertPositiveIntegerDimension("size", value)).toThrow(RangeError);
      })
    );
  });
});
