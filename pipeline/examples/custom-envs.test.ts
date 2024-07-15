import { createYamlLocalPipeline } from "./__utils__/helpers";
import config from "./custom-envs";

/**
 * This test is auto-generated.
 * Modifications will be overwritten on every `yarn test` run!
 */

it("matches snapshot for custom-envs local pipeline YAML", async () => {
  expect(await createYamlLocalPipeline(config)).toMatchSnapshot();
});
