import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { resolveStaticFilePath } from "./static-server-path.mjs";

describe("resolveStaticFilePath", () => {
  it("resolves normal static paths inside the root", () => {
    const root = "/repo";

    expect(resolveStaticFilePath(root, "/examples/demo/index.html")).toBe(
      join(root, "examples/demo/index.html")
    );
  });

  it("rejects traversal and sibling-prefix paths", () => {
    const root = "/repo";

    expect(resolveStaticFilePath(root, "/../repo-secret/file.txt")).toBeNull();
    expect(resolveStaticFilePath(root, "/%2e%2e/repo-secret/file.txt")).toBeNull();
  });

  it("maps the root path to the FBO example", () => {
    const root = "/repo";

    expect(resolveStaticFilePath(root, "/")).toBe(
      join(root, "examples/fbo-postprocess/index.html")
    );
  });
});
