import { createYamlLocalPipeline } from "./__utils__/helpers";
import config from "./modify-generated-yaml";

/**
 * This test is auto-generated.
 * Modifications will be overwritten on every `yarn test` run!
 */

it("matches snapshot for modify-generated-yaml local pipeline YAML", async () => {
  expect(await createYamlLocalPipeline(config)).toMatchSnapshot();
});
