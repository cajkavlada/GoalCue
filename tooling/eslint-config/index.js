import js from "@eslint/js";
import tseslint from "typescript-eslint";
import pluginReact from "eslint-plugin-react";
import pluginReactHooks from "eslint-plugin-react-hooks";
import pluginReactRefresh from "eslint-plugin-react-refresh";
import pluginTurbo from "eslint-plugin-turbo";
import eslintConfigPrettier from "eslint-config-prettier";
import globals from "globals";

export default tseslint.config(
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
    files: ["**/*.test.{js,jsx,ts,tsx}", "**/setupTests.{ts,tsx,js,jsx}"], // TODO: remove setupTests from here
    languageOptions: {
      globals: {
        ...globals.vitest,
      },
    },
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
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
      react: pluginReact,
      "react-hooks": pluginReactHooks,
      "react-refresh": pluginReactRefresh,
      turbo: pluginTurbo,
    },
    rules: {
      // React plugin recommended
      ...pluginReact.configs.recommended.rules,
      // React Hooks plugin
      ...pluginReactHooks.configs.recommended.rules,
      // React Compiler rule
      "react-hooks/react-compiler": "error",
      // react-refresh rule for Vite safety
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      // Turbo repo env var check
      "turbo/no-undeclared-env-vars": "warn",
      // Turn off React-in-JSX-scope for new JSX transform
      "react/react-in-jsx-scope": "off",
      // Turn off react-refresh/only-export-components for now
      "react-refresh/only-export-components": "off",
    },
    settings: {
      react: {
        version: "detect",
      },
    },
  },
  {
    name: "prettier",
    rules: eslintConfigPrettier.rules,
  }
);
