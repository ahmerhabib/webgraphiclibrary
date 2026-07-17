import { DisposedResourceError } from "./errors";

/**
 * Throw a {@link DisposedResourceError} for `resourceName` when `disposed` is
 * true. Used by the resource wrappers to reject use-after-dispose.
 *
 * @throws {DisposedResourceError} when `disposed` is true.
 */
export function assertNotDisposed(resourceName: string, disposed: boolean): void {
  if (disposed) {
    throw new DisposedResourceError(resourceName);
  }
}
