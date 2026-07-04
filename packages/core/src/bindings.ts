import type { GLContext } from "./gl";

/**
 * A single WebGL binding point to capture and restore. `binding` is the
 * `getParameter` enum used to read the currently bound value (for example
 * `FRAMEBUFFER_BINDING`), and `restore` rebinds a previously captured value.
 */
export interface BindingSlot {
  binding: number;
  restore: (value: unknown) => void;
}

/**
 * Capture the current values of the given binding points, run `operation`,
 * then restore the captured values in a `finally` block even if `operation`
 * throws. This keeps resource helpers from leaking global WebGL binding state
 * into the caller's renderer.
 */
export function withSavedBindings<T>(
  gl: GLContext,
  slots: readonly BindingSlot[],
  operation: () => T
): T {
  const saved = slots.map((slot) => ({ slot, value: gl.getParameter(slot.binding) as unknown }));

  try {
    return operation();
  } finally {
    for (const { slot, value } of saved) {
      slot.restore(value);
    }
  }
}
