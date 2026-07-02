import { DisposedResourceError } from "./errors";

export function assertNotDisposed(resourceName: string, disposed: boolean): void {
  if (disposed) {
    throw new DisposedResourceError(resourceName);
  }
}
