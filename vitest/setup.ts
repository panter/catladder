import { vi } from "vitest";

process.env.CI_COMMIT_REF_NAME = "some-commit";
process.env.CI_MERGE_REQUEST_IID = "1234";

vi.spyOn(global.Date.prototype, "toISOString").mockReturnValue(
  "01-01-2023 12:13:14",
);

vi.mock("../packages/pipeline/src/pipeline/detectPackageManager", () => ({
  // examples opt into pnpm via `packageManager: "pnpm"` in their config;
  // everything else keeps the historical yarn@3 detection result
  detectPackageManager: (explicitType?: "yarn" | "pnpm") =>
    explicitType === "pnpm"
      ? { type: "pnpm", version: "10.14.0" }
      : { type: "yarn", version: "3" },
}));

vi.mock("../packages/pipeline/src/pipeline/projectFiles", () => ({
  // examples are generated as if they lived in a plain yarn berry
  // project. Without this, the docker COPY lines would mirror whichever
  // package-manager config files *this* repository happens to have, so
  // the snapshots would change with catladder's own tooling.
  projectFileExists: (path: string) => [".yarnrc.yml", ".yarn"].includes(path),
}));

vi.mock(
  "../packages/pipeline/src/pipeline/yarn/yarnUtils",
  async (importOriginal) => ({
    ...(await importOriginal<object>()),
    // workspace membership for the workspace-verify example — locations
    // are unique to it, so every other example keeps
    // componentIsInWorkspace = false as before
    getWorkspaces: () => [
      {
        name: "api",
        location: "services/api",
        workspaceDependencies: [],
        mismatchedWorkspaceDependencies: [],
      },
      {
        name: "www",
        location: "services/www",
        workspaceDependencies: [],
        mismatchedWorkspaceDependencies: [],
      },
    ],
  }),
);

vi.mock("../packages/pipeline/src/pipeline/pnpm/pnpmUtils", () => ({
  getPnpmWorkspaces: () => [],
  getPnpmPatchFiles: () => [],
}));
