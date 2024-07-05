import { createAllPipelines } from "./__utils__/helpers";
import config from "./local-dot-env";

/**
 * This test is auto-generated.
 * Modifications will be overwritten on every `yarn test` run!
 */
it("matches snapshot for local-dot-env", async () => {
  expect(await createAllPipelines(config)).toMatchSnapshot();
});
