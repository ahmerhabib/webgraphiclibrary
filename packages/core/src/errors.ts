/**
 * Base error for every failure raised by webgraphiclibrary. All typed errors in
 * the library extend this, so `catch (e) { if (e instanceof WebGLError) ... }`
 * matches them all (across subpath imports).
 */
export class WebGLError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebGLError";
  }
}

/**
 * Thrown when a resource is used after `dispose()` has been called. Extends
 * {@link WebGLError}.
 */
export class DisposedResourceError extends WebGLError {
  constructor(resourceName: string) {
    super(`${resourceName} has been disposed.`);
    this.name = "DisposedResourceError";
  }
}
