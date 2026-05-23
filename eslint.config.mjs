import globals from "globals"
import importPluginRaw from "eslint-plugin-import"
import nPluginRaw from "eslint-plugin-n"
import promisePluginRaw from "eslint-plugin-promise"
import prettierPluginRaw from "eslint-plugin-prettier"
import tsParserRaw from "@typescript-eslint/parser"
import tsPluginRaw from "@typescript-eslint/eslint-plugin"

const importPlugin = importPluginRaw.default ?? importPluginRaw
const nPlugin = nPluginRaw.default ?? nPluginRaw
const promisePlugin = promisePluginRaw.default ?? promisePluginRaw
const prettierPlugin = prettierPluginRaw.default ?? prettierPluginRaw
const tsParser = tsParserRaw.default ?? tsParserRaw
const tsPlugin = tsPluginRaw.default ?? tsPluginRaw

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    files: ["**/*.{ts,tsx,mts,cts}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
      globals: globals.node,
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      import: importPlugin,
      n: nPlugin,
      promise: promisePlugin,
      prettier: prettierPlugin,
    },
    settings: {
      "import/resolver": {
        node: true,
      },
    },
    rules: {
      ...(importPlugin.configs?.recommended?.rules ?? {}),
      ...(nPlugin.configs?.["flat/recommended"]?.rules ?? {}),
      ...(promisePlugin.configs?.recommended?.rules ?? {}),
      "@typescript-eslint/no-unused-vars": "warn",
      "prettier/prettier": [
        "error",
        {
          endOfLine: "auto",
          singleQuote: true,
          jsxSingleQuote: true,
          semi: false,
          trailingComma: "none",
        },
      ],
      "n/no-unsupported-features/es-syntax": "off",
      "n/no-unsupported-features/node-builtins": "off",
      "n/no-missing-import": "off",
      "import/no-unresolved": "off",
      "no-console": "warn",
      "import/order": ["error", { "newlines-between": "always" }],
    },
  },
]
