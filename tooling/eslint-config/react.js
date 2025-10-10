import pluginReact from "eslint-plugin-react";
import pluginReactHooks from "eslint-plugin-react-hooks";
import pluginReactRefresh from "eslint-plugin-react-refresh";
import { defineConfig } from "eslint/config";
import eslintConfigPrettier from "eslint-config-prettier";
import baseConfig from "./base.js";

export default defineConfig(
  baseConfig,
  {
    files: ["**/*.{ts,tsx,js,jsx}"],
    plugins: {
      react: pluginReact,
      "react-hooks": pluginReactHooks,
      "react-refresh": pluginReactRefresh,
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
