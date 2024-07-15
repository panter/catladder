import { createYamlLocalPipeline } from "./__utils__/helpers";
import config from "./cloud-run-with-sql";

/**
 * This test is auto-generated.
 * Modifications will be overwritten on every `yarn test` run!
 */

it("matches snapshot for cloud-run-with-sql local pipeline YAML", async () => {
  expect(await createYamlLocalPipeline(config)).toMatchSnapshot();
});
