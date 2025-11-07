import { vi } from "vitest";

process.env.INLINE_PIPELINE_IMAGE_TAG = "the-version";
process.env.INLINE_DOCKER_REGISTRY = "path/to/docker";
process.env.CI_COMMIT_REF_NAME = "some-commit";
process.env.CI_MERGE_REQUEST_IID = "1234";

vi.spyOn(global.Date.prototype, "toISOString").mockReturnValue(
  "01-01-2023 12:13:14",
);

vi.mock("../pipeline/src/pipeline/yarn/yarnUtils", () => ({
  getYarnVersion: () => "3",
  getWorkspaces: () => [],
}));
