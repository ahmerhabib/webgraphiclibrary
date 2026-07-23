/** A WebGL 1 or WebGL 2 rendering context — the input to every wrapper. */
export type GLContext = WebGLRenderingContext | WebGL2RenderingContext;

type WebGLLike = {
  createFramebuffer: unknown;
  bindFramebuffer: unknown;
  checkFramebufferStatus: unknown;
};

/**
 * Structural check that `value` is a usable WebGL rendering context (duck-typed
 * on the framebuffer methods). The wrappers use it to fail early on a bad `gl`.
 */
export function isWebGLContext(value: unknown): value is GLContext {
  if (value === null || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<WebGLLike>;
  return (
    typeof candidate.createFramebuffer === "function" &&
    typeof candidate.bindFramebuffer === "function" &&
    typeof candidate.checkFramebufferStatus === "function"
  );
}

/** Narrow a context to WebGL 2 by feature-detecting `texStorage2D`. */
export function isWebGL2(gl: GLContext): gl is WebGL2RenderingContext {
  return "texStorage2D" in gl && typeof gl.texStorage2D === "function";
}

/**
 * Enable the extensions that make float / half-float color attachments
 * renderable for the given pixel `type`. No-op for other types; safe to call
 * repeatedly (`getExtension` is idempotent).
 */
export function enableFloatColorRendering(gl: GLContext, type: number): void {
  const halfFloat = "HALF_FLOAT" in gl ? gl.HALF_FLOAT : 0x8d61;

  if (type !== gl.FLOAT && type !== halfFloat) {
    return;
  }

  if (isWebGL2(gl)) {
    gl.getExtension("EXT_color_buffer_float");
  } else if (type === gl.FLOAT) {
    gl.getExtension("OES_texture_float");
    gl.getExtension("WEBGL_color_buffer_float");
  } else {
    gl.getExtension("OES_texture_half_float");
    gl.getExtension("EXT_color_buffer_half_float");
  }
}

/**
 * Enable `EXT_color_buffer_float` when a sized WebGL2 float internal format
 * (for example `RGBA16F` or `RG32F`) is used for renderbuffer or texture
 * color storage. No-op for non-float formats.
 */
export function enableFloatInternalFormatRendering(
  gl: WebGL2RenderingContext,
  internalFormat: number
): void {
  switch (internalFormat) {
    case gl.R16F:
    case gl.RG16F:
    case gl.RGBA16F:
    case gl.R32F:
    case gl.RG32F:
    case gl.RGBA32F:
    case gl.R11F_G11F_B10F:
      gl.getExtension("EXT_color_buffer_float");
  }
}

/** Map a `checkFramebufferStatus` result to a human-readable message. */
export function getFramebufferStatusMessage(gl: GLContext, status: number): string {
  const statuses = new Map<number, string>([
    [gl.FRAMEBUFFER_COMPLETE, "Framebuffer is complete."],
    [gl.FRAMEBUFFER_INCOMPLETE_ATTACHMENT, "Framebuffer has an incomplete attachment."],
    [gl.FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT, "Framebuffer has no image attached to it."],
    [gl.FRAMEBUFFER_INCOMPLETE_DIMENSIONS, "Framebuffer attachments have mismatched dimensions."],
    [gl.FRAMEBUFFER_UNSUPPORTED, "Framebuffer configuration is unsupported by this context."]
  ]);

  return statuses.get(status) ?? `Unknown framebuffer status: ${status}.`;
}
