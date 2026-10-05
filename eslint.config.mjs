import nextCoreWebVitals from "eslint-config-next/core-web-vitals"

/** Lint the app code; generated output, dependencies and the vendored server modules are skipped. */
const config = [
  {
    ignores: [
      ".next/**",
      ".next-*/**",
      "node_modules/**",
      "server/node_modules/**",
      "server/.local-uploads/**",
      "playwright-report/**",
      "test-results/**",
      "public/sw.js",
      "next-env.d.ts",
    ],
  },
  ...nextCoreWebVitals,
  {
    rules: {
      // Member photos come from S3 (or local storage in development) and the
      // app runs with image optimisation off, so plain <img> is intended.
      "@next/next/no-img-element": "off",
      "react/no-unescaped-entities": "off",
      // Existing screens load their data in mount effects; flagged as warnings
      // so new code is nudged without failing the build on old code.
      "react-hooks/exhaustive-deps": "warn",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/refs": "warn",
      "import/no-anonymous-default-export": "off",
    },
  },
]

export default config
