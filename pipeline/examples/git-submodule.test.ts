import { createYamlLocalPipeline } from "./__utils__/helpers";
import config from "./git-submodule";

/**
 * This test is auto-generated.
 * Modifications will be overwritten on every `yarn test` run!
 */

it("matches snapshot for git-submodule local pipeline YAML", async () => {
  expect(await createYamlLocalPipeline(config)).toMatchSnapshot();
});
