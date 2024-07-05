import { createAllPipelines } from "./__utils__/helpers";
import config from "./native-app";

/**
 * This test is auto-generated.
 * Modifications will be overwritten on every `yarn test` run!
 */
it("matches snapshot for native-app", async () => {
  expect(await createAllPipelines(config)).toMatchSnapshot();
});
