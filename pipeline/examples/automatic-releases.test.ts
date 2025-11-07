import { it, expect } from "vitest";
import { createYamlLocalPipeline } from "./__utils__/helpers";
import config from "./automatic-releases";

/**
 * This test is auto-generated.
 * Modifications will be overwritten on every `yarn test` run!
 */

it("matches snapshot for automatic-releases local pipeline YAML", async () => {
  expect(await createYamlLocalPipeline(config)).toMatchSnapshot();
});
