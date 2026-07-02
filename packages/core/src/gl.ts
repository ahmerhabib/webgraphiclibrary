export type GLContext = WebGLRenderingContext | WebGL2RenderingContext;

type WebGLLike = {
  createFramebuffer: unknown;
  bindFramebuffer: unknown;
  checkFramebufferStatus: unknown;
};

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

export function isWebGL2(gl: GLContext): gl is WebGL2RenderingContext {
  return "texStorage2D" in gl && typeof gl.texStorage2D === "function";
}

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
