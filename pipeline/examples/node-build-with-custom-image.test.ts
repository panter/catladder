import { createAllPipelines } from "./__utils__/helpers";
import config from "./node-build-with-custom-image";

/**
 * This test is auto-generated.
 * Modifications will be overwritten on every `yarn test` run!
 */
it("matches snapshot for node-build-with-custom-image", async () => {
  expect(await createAllPipelines(config)).toMatchSnapshot();
});
