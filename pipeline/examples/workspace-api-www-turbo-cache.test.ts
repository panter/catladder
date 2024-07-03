import { createYamlLocalPipeline } from "./__utils__/helpers";
import config from "./workspace-api-www-turbo-cache";

/**
 * This test is auto-generated.
 * Modifications will be overwritten on every `yarn test` run!
 */

it("matches snapshot for workspace-api-www-turbo-cache local pipeline YAML", async () => {
  expect(await createYamlLocalPipeline(config)).toMatchSnapshot();
});
