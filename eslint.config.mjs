import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

/** Flat config. eslint-config-next v16 exports flat config arrays directly. */
export default [
  ...(Array.isArray(coreWebVitals) ? coreWebVitals : [coreWebVitals]),
  ...(Array.isArray(typescript) ? typescript : [typescript]),
  {
    ignores: ["node_modules/**", ".next/**", "storage/**", "prisma/migrations/**"],
  },
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
];
