import { it, expect } from "vitest";
import { createYamlLocalPipeline } from "./__utils__/helpers";
import config from "./cloud-run-existing-image";

/**
 * This test is auto-generated.
 * Modifications will be overwritten on every `yarn test` run!
 */

it("matches snapshot for cloud-run-existing-image local pipeline YAML", async () => {
  expect(await createYamlLocalPipeline(config)).toMatchSnapshot();
});
