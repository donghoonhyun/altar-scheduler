// Flat Config (ESLint v8 + typescript-eslint v7)
import tseslint from "typescript-eslint";

/** @type {import('eslint').Linter.FlatConfig[]} */
export default tseslint.config(
  { ignores: ["lib/**", "dist/**", "node_modules/**"] },
  ...tseslint.configs.recommended,
  {
    rules: {
      // 문제를 일으키던 룰 우선 끄기(필요시 나중에 켜세요)
      "@typescript-eslint/no-unused-expressions": "off",
    },
  }
);
