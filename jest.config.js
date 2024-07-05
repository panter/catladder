/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testPathIgnorePatterns: ["dist", "/__utils__/"],
  testMatch: [
    "**/__tests__/**/*.[jt]s?(x)",
    "**/pipeline/examples/*.test.ts",
  ],
  setupFiles: ["./jest/setup.ts"],
};
