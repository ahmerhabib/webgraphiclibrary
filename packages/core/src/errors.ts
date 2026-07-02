export class WebGLError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebGLError";
  }
}

export class DisposedResourceError extends WebGLError {
  constructor(resourceName: string) {
    super(`${resourceName} has been disposed.`);
    this.name = "DisposedResourceError";
  }
}
