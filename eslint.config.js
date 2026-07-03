import js from "@eslint/js";
import tseslint from "typescript-eslint";

const typeCheckedConfigs = tseslint.configs.recommendedTypeChecked.map((config) => ({
  ...config,
  files: ["**/*.ts"]
}));

export default tseslint.config(
  {
    ignores: ["dist", "coverage", "node_modules", "packages/*/dist", "eslint.config.js"]
  },
  js.configs.recommended,
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      globals: {
        process: "readonly"
      }
    }
  },
  ...typeCheckedConfigs,
  {
    files: ["packages/**/*.ts", "tsup.config.ts", "vitest.config.ts"],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.base.json",
        tsconfigRootDir: import.meta.dirname
      }
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-unnecessary-condition": "error"
    }
  }
);
