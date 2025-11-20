// eslint.config.mjs
import typescriptEslint from "typescript-eslint";

export default [
  // Apply rules to all TS files
  {
    files: ["**/*.ts"],

    // Ignore compiled JS output
    ignores: ["out/**"],

    plugins: {
      "@typescript-eslint": typescriptEslint.plugin,
    },

    languageOptions: {
      parser: typescriptEslint.parser,
      ecmaVersion: 2022,
      sourceType: "module",
    },

    rules: {
      // Enforce consistent naming
      "@typescript-eslint/naming-convention": [
        "warn",
        {
          selector: "import",
          format: ["camelCase", "PascalCase"],
        },
      ],

      // Require curly braces for all control statements
      curly: "warn",

      // Enforce strict equality
      eqeqeq: "warn",

      // Do not allow throwing literals
      "no-throw-literal": "warn",

      // Require semicolons
      semi: "warn",
    },
  },
];
