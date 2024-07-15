import { createYamlLocalPipeline } from "./__utils__/helpers";
import config from "./kubernetes-with-mongodb";

/**
 * This test is auto-generated.
 * Modifications will be overwritten on every `yarn test` run!
 */

it("matches snapshot for kubernetes-with-mongodb local pipeline YAML", async () => {
  expect(await createYamlLocalPipeline(config)).toMatchSnapshot();
});
