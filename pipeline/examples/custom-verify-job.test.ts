import { createYamlLocalPipeline } from "./__utils__/helpers";
import config from "./custom-verify-job";

/**
 * This test is auto-generated.
 * Modifications will be overwritten on every `yarn test` run!
 */

it("matches snapshot for custom-verify-job local pipeline YAML", async () => {
  expect(await createYamlLocalPipeline(config)).toMatchSnapshot();
});
