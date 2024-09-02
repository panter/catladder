import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";

const ignoreFiles = [
  // Add specific file paths to ignore
].map((file) => `**/${file}`);
const ignoreDirs = [
  // Add directories to ignore
  "dist",
  "node_modules",
  "public",
  ".docusaurus",
].map((dir) => `**/${dir}/**/*`);

export default [
  { languageOptions: { globals: { ...globals.node, ...globals.es2022 } } },
  eslintPluginPrettierRecommended,
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-require-imports": "warn",
    },
  },
  { ignores: [...ignoreDirs, ...ignoreFiles] },
];
