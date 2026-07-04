import { describe, expect, it } from "vitest";
import { withSavedBindings } from "./bindings";
import type { GLContext } from "./gl";

function createParameterGL(values: Record<number, unknown>): GLContext {
  return {
    getParameter: (parameter: number) => values[parameter] ?? null
  } as unknown as GLContext;
}

describe("withSavedBindings", () => {
  it("captures binding values and restores them after the operation", () => {
    const restored: Array<[number, unknown]> = [];
    const gl = createParameterGL({ 1: "foo-prev", 2: "bar-prev" });
    let ran = false;

    withSavedBindings(
      gl,
      [
        { binding: 1, restore: (value) => restored.push([1, value]) },
        { binding: 2, restore: (value) => restored.push([2, value]) }
      ],
      () => {
        ran = true;
      }
    );

    expect(ran).toBe(true);
    expect(restored).toEqual([
      [1, "foo-prev"],
      [2, "bar-prev"]
    ]);
  });

  it("restores bindings even when the operation throws", () => {
    const restored: unknown[] = [];
    const gl = createParameterGL({ 0: "prev" });

    expect(() =>
      withSavedBindings(gl, [{ binding: 0, restore: (value) => restored.push(value) }], () => {
        throw new Error("boom");
      })
    ).toThrow("boom");

    expect(restored).toEqual(["prev"]);
  });

  it("returns the operation result and handles empty slot lists", () => {
    const gl = createParameterGL({});
    expect(withSavedBindings(gl, [], () => 42)).toBe(42);
  });
});
