import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "node_modules", "external", "coverage"] },
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/explicit-function-return-type": [
        "error",
        {
          allowExpressions: true,
          allowTypedFunctionExpressions: true,
        },
      ],
      "@typescript-eslint/explicit-member-accessibility": [
        "error",
        {
          accessibility: "explicit",
          overrides: { constructors: "no-public" },
        },
      ],
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/strict-boolean-expressions": "off",
      "@typescript-eslint/restrict-template-expressions": "off",
      "@typescript-eslint/no-non-null-assertion": "warn",
    },
  },
  {
    files: ["src/**/__tests__/**", "src/**/*.test.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-member-accessibility": "off",
      "@typescript-eslint/no-floating-promises": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
    },
  },
);
