import { isAbsolute, join, relative, resolve } from "node:path";

const defaultStaticPath = "examples/fbo-postprocess/index.html";

export function resolveStaticFilePath(root, requestPath) {
  let pathname;

  try {
    pathname = decodeURIComponent(requestPath);
  } catch {
    return null;
  }

  const relativePath = pathname === "/" ? defaultStaticPath : pathname.replace(/^\/+/, "");
  const filePath = resolve(root, relativePath);
  const relativePathFromRoot = relative(root, filePath);

  if (relativePathFromRoot.startsWith("..") || isAbsolute(relativePathFromRoot)) {
    return null;
  }

  return filePath;
}

export function defaultStaticFilePath(root) {
  return join(root, defaultStaticPath);
}
