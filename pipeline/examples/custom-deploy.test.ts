import {
  createAllPipelines,
  createYamlChildPipeline,
  createYamlLocalPipeline,
} from "./__utils__/helpers";
import config from "./custom-deploy";

/**
 * This test is auto-generated.
 * Modifications will be overwritten on every `yarn test` run!
 */

it("matches snapshot for custom-deploy", async () => {
  expect(await createAllPipelines(config)).toMatchSnapshot();
});

jest.mock(
  "../src/pipeline/gitlab/getPipelineTriggerForGitlabChildPipeline",
  () => ({
    getPipelineTriggerForGitlabChildPipeline: () =>
      process.env.TEST_MOCK_TRIGGER ?? "mr",
  }),
);

it("matches snapshot for cloud-run-memory-limit child pipeline YAML mainBranch", async () => {
  process.env.TEST_MOCK_TRIGGER = "mainBranch";
  expect(await createYamlChildPipeline(config)).toMatchSnapshot();
});

it("matches snapshot for cloud-run-memory-limit child pipeline YAML taggedRelease", async () => {
  process.env.TEST_MOCK_TRIGGER = "taggedRelease";
  expect(await createYamlChildPipeline(config)).toMatchSnapshot();
});

it("matches snapshot for cloud-run-memory-limit child pipeline YAML mr", async () => {
  process.env.TEST_MOCK_TRIGGER = "mr";
  expect(await createYamlChildPipeline(config)).toMatchSnapshot();
});

it("matches snapshot for cloud-run-memory-limit local pipeline YAML", async () => {
  expect(await createYamlLocalPipeline(config)).toMatchSnapshot();
});
