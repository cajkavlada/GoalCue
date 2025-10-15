import baseConfig from "@gc/eslint-config/react";

export default [
  ...baseConfig,
  {
    ignores: ["src/components/modal/drawer/vaul/**"],
  },
];
