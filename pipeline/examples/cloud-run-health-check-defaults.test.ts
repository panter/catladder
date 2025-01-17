import { createYamlLocalPipeline } from "./__utils__/helpers";
import config from "./cloud-run-health-check-defaults";

/**
 * This test is auto-generated.
 * Modifications will be overwritten on every `yarn test` run!
 */

it("matches snapshot for cloud-run-health-check-defaults local pipeline YAML", async () => {
  expect(await createYamlLocalPipeline(config)).toMatchSnapshot();
});
