import js from "@eslint/js";
import tseslint from "typescript-eslint";
import pluginTurbo from "eslint-plugin-turbo";
import { defineConfig } from "eslint/config";
import eslintConfigPrettier from "eslint-config-prettier";
import globals from "globals";

export default defineConfig(
  {
    ignores: [
      "dist",
      "build",
      "coverage",
      "node_modules",
      ".turbo",
      ".output",
      ".tanstack",
      ".nitro",
      ".vercel",
      "pnpm-lock.yaml",
    ],
  },
  {
    files: ["**/*.test.{js,jsx,ts,tsx}"],
    languageOptions: {
      globals: {
        ...globals.vitest,
      },
    },
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx,js,jsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parser: tseslint.parser,
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.serviceworker,
      },
    },
    plugins: {
      turbo: pluginTurbo,
    },
    rules: {
      // Turbo repo env var check
      "turbo/no-undeclared-env-vars": "warn",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    name: "prettier",
    rules: eslintConfigPrettier.rules,
  }
);
