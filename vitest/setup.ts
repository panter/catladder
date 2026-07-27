import { vi } from "vitest";

process.env.CI_COMMIT_REF_NAME = "some-commit";
process.env.CI_MERGE_REQUEST_IID = "1234";

vi.spyOn(global.Date.prototype, "toISOString").mockReturnValue(
  "01-01-2023 12:13:14",
);

vi.mock(
  "../packages/pipeline/src/pipeline/yarn/yarnUtils",
  async (importOriginal) => ({
    ...(await importOriginal<object>()),
    getYarnVersion: () => "3",
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
