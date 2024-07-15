import { createYamlLocalPipeline } from "./__utils__/helpers";
import config from "./wait-for-other-deploy";

/**
 * This test is auto-generated.
 * Modifications will be overwritten on every `yarn test` run!
 */

it("matches snapshot for wait-for-other-deploy local pipeline YAML", async () => {
  expect(await createYamlLocalPipeline(config)).toMatchSnapshot();
});
