/* eslint-env node */
/** @type {import('eslint').Linter.Config[]} */
const tsEslint = require("@typescript-eslint/eslint-plugin/use-at-your-own-risk/raw-plugin");

module.exports = [
  {
    ignores: [
      "**/dist/**", 
      "**/node_modules/**", 
      "dist/", 
      "node_modules/", 
      "**/.local/**", 
      "*.txt", 
      "*.json"
    ],
  },
  ...tsEslint.flatConfigs["flat/recommended"],
  {
    rules: {
      "no-console": "warn",
      "no-debugger": "error",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    files: ["server/**/*.ts", "server/**/*.js", "shared/**/*.ts"],
    rules: {
      "no-console": "off",
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
];
