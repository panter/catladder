import { createYamlLocalPipeline } from "./__utils__/helpers";
import config from "./local-dot-env";

/**
 * This test is auto-generated.
 * Modifications will be overwritten on every `yarn test` run!
 */

it("matches snapshot for local-dot-env local pipeline YAML", async () => {
  expect(await createYamlLocalPipeline(config)).toMatchSnapshot();
});
