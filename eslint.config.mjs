import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

// eslint-config-next 16 ships native flat configs. The previous setup went
// through `FlatCompat`, which in v16 throws "Converting circular structure to
// JSON" while validating the eslintrc-shaped config it no longer is.
const eslintConfig = [
  {
    // Without this ESLint walks the build output and reports thousands of
    // bogus errors in minified chunks.
    ignores: [".next/**", "out/**", "build/**", "coverage/**", "next-env.d.ts"],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    // CommonJS config files at the repo root legitimately use require().
    files: ["*.js", "*.cjs"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  {
    // A leading underscore marks a binding that is deliberately unused. Route
    // handlers are the case that forces it: Next fixes the signature, so a
    // POST that reads nothing from the request still has to declare the
    // parameter, and its own test types the argument off `Parameters<typeof
    // POST>[0]`. Dropping the parameter to satisfy the rule would break that.
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    // eslint-config-next 16 pulls eslint-plugin-react-hooks 7, which adds the
    // React Compiler rule set. These three flag 24 pre-existing sites — the
    // sync-state-from-storage-on-mount pattern, `window.location.href = ...`
    // on the checkout redirect, and a fingerprint call during render. Some are
    // worth fixing and some are false positives for what this code does;
    // triaging them is its own task, not a dependency bump. Kept as warnings
    // so they stay visible without turning every unrelated CI run red.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/purity": "warn",
    },
  },
];

export default eslintConfig;
