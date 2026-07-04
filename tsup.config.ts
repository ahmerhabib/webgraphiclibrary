import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "packages/index.ts",
    buffer: "packages/buffer/src/index.ts",
    core: "packages/core/src/index.ts",
    fbo: "packages/fbo/src/index.ts",
    program: "packages/program/src/index.ts",
    shader: "packages/shader/src/index.ts",
    texture: "packages/texture/src/index.ts"
  },
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  // Shared code (e.g. the `core` error classes) must live in one chunk so a
  // class like WebGLError has a single identity across every subpath export;
  // otherwise `instanceof` fails between, say, `.../core` and `.../shader`.
  splitting: true,
  treeshake: true
});
