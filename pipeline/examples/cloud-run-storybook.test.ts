import {
  createAllPipelines,
  createYamlLocalPipeline,
} from "./__utils__/helpers";
import config from "./cloud-run-storybook";

/**
 * This test is auto-generated.
 * Modifications will be overwritten on every `yarn test` run!
 */

it("matches snapshot for cloud-run-storybook", async () => {
  expect(await createAllPipelines(config)).toMatchSnapshot();
});

it("matches snapshot for cloud-run-memory-limit local pipeline YAML", async () => {
  expect(await createYamlLocalPipeline(config)).toMatchSnapshot();
});
