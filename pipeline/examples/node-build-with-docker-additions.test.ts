import { createYamlLocalPipeline } from "./__utils__/helpers";
import config from "./node-build-with-docker-additions";

/**
 * This test is auto-generated.
 * Modifications will be overwritten on every `yarn test` run!
 */

it("matches snapshot for node-build-with-docker-additions local pipeline YAML", async () => {
  expect(await createYamlLocalPipeline(config)).toMatchSnapshot();
});
