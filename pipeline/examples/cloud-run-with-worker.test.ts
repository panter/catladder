import {
  createAllPipelines,
  createYamlLocalPipeline,
} from "./__utils__/helpers";
import config from "./cloud-run-with-worker";

/**
 * This test is auto-generated.
 * Modifications will be overwritten on every `yarn test` run!
 */

it("matches snapshot for cloud-run-with-worker", async () => {
  expect(await createAllPipelines(config)).toMatchSnapshot();
});

it("matches snapshot for cloud-run-memory-limit local pipeline YAML", async () => {
  expect(await createYamlLocalPipeline(config)).toMatchSnapshot();
});
