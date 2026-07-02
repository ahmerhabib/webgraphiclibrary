export function assertPositiveIntegerDimension(name: "width" | "height", value: number): number {
  if (!Number.isInteger(value)) {
    throw new TypeError(`${name} must be an integer.`);
  }

  if (value <= 0) {
    throw new RangeError(`${name} must be greater than 0.`);
  }

  return value;
}
