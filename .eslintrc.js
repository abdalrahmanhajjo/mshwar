module.exports = {
  root: true,
  env: { browser: true, es2022: true, node: true },
  extends: ["next/core-web-vitals", "eslint:recommended", "plugin:@typescript-eslint/recommended", "prettier"],
  ignorePatterns: ["dist/", "build/", "node_modules/", ".next/", "*.config.js", "*.config.mjs"],
  rules: {
    "react/jsx-uses-react": "off",
    "react/jsx-uses-vars": "error",
    "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/explicit-module-boundary-types": "off",
    "@typescript-eslint/no-non-null-assertion": "warn",
    "no-console": "warn",
    "prefer-const": "error",
    "no-var": "error",
    eqeqeq: ["error", "always"],
  },
  overrides: [
    {
      files: ["services/api/**/*.py"],
      extends: [],
      rules: {},
    },
  ],
};
