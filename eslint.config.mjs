// Run this command to generate base config and vs code settings:
// pnpm dlx @antfu/eslint-config@latest

import antfu from "@antfu/eslint-config";

export default antfu({
  type: "app",
  next: true,
  typescript: true,
  formatters: true,
  stylistic: {
    indent: 2,
    semi: true,
    quotes: "double",
  },
  ignores: [
    "routeTree.gen.ts",
    "src/assets/lottie/animation-loader.json",
    "src/components/ui", // add ui directory files
  ],
}, {
  rules: {
    "eslint-comments/no-unlimited-disable": "off",
    "unused-imports/no-unused-imports": "warn",
    "no-redeclare": "off",
    "ts/consistent-type-definitions": ["error", "type"],
    "no-console": ["warn"],
    "antfu/no-top-level-await": ["off"],
    "node/prefer-global/process": ["off"],
    "node/no-process-env": ["error"],
    "perfectionist/sort-imports": ["error", {
      tsconfigRootDir: ".",
    }],
    "style/brace-style": ["error", "1tbs", { allowSingleLine: true }],
  },
});
