import { createYamlLocalPipeline } from "./__utils__/helpers";
import config from "./modify-generated-files";

/**
 * This test is auto-generated.
 * Modifications will be overwritten on every `yarn test` run!
 */

it("matches snapshot for modify-generated-files local pipeline YAML", async () => {
  expect(await createYamlLocalPipeline(config)).toMatchSnapshot();
});
