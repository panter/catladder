import { createAllPipelines } from "./__utils__/helpers";
import config from "./meteor-kubernetes";

/**
 * This test is auto-generated.
 * Modifications will be overwritten on every `yarn test` run!
 */
it("matches snapshot for meteor-kubernetes", async () => {
  expect(await createAllPipelines(config)).toMatchSnapshot();
});
