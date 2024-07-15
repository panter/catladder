import { createYamlLocalPipeline } from "./__utils__/helpers";
import config from "./custom-sbom-java";

/**
 * This test is auto-generated.
 * Modifications will be overwritten on every `yarn test` run!
 */

it("matches snapshot for custom-sbom-java local pipeline YAML", async () => {
  expect(await createYamlLocalPipeline(config)).toMatchSnapshot();
});
