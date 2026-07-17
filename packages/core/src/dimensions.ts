/**
 * Validate that a texture/framebuffer dimension is a positive integer, and
 * return it unchanged.
 *
 * @throws {TypeError} if `value` is not an integer.
 * @throws {RangeError} if `value` is less than or equal to 0.
 */
export function assertPositiveIntegerDimension(name: "width" | "height", value: number): number {
  if (!Number.isInteger(value)) {
    throw new TypeError(`${name} must be an integer.`);
  }

  if (value <= 0) {
    throw new RangeError(`${name} must be greater than 0.`);
  }

  return value;
}
