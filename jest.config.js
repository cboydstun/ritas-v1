const nextJest = require("next/jest");

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: "./",
});

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  testEnvironment: "jest-environment-jsdom",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  testMatch: [
    // Only files ending in .test/.spec. Plain helper files placed inside a
    // __tests__ folder were being executed as suites and failing with
    // "your test suite must contain at least one test".
    "**/__tests__/**/*.(spec|test).[jt]s?(x)",
    "**/?(*.)+(spec|test).[jt]s?(x)",
  ],
  // nanoid ships ESM only, so it has to be transformed rather than skipped
  // along with the rest of node_modules.
  transformIgnorePatterns: [
    "/node_modules/(?!(nanoid)/)",
    "^.+\\.module\\.(css|sass|scss)$",
  ],
  // Seeded just under the coverage at the time these were added, so the number
  // can only go up. Raise them when a run comfortably clears them; do not
  // lower them to get a build out.
  coverageThreshold: {
    // Everything outside src/lib — a path-keyed threshold below removes those
    // files from this bucket.
    global: {
      statements: 32,
      branches: 30,
      functions: 21,
      lines: 33,
    },
    // The money and availability logic is held to a much higher bar than the
    // page components that dominate the global figure.
    "./src/lib/": {
      statements: 74,
      branches: 67,
      functions: 79,
      lines: 76,
    },
  },
  collectCoverageFrom: [
    "src/**/*.{js,jsx,ts,tsx}",
    "!src/**/*.d.ts",
    "!src/**/*.stories.{js,jsx,ts,tsx}",
    "!src/**/__tests__/**",
  ],
};

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig);
