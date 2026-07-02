import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "packages/fbo/src/index.ts",
    core: "packages/core/src/index.ts",
    fbo: "packages/fbo/src/index.ts"
  },
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true
});
