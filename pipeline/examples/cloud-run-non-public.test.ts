import { createAllPipelines } from "./__utils__/helpers";
import config from "./cloud-run-non-public";

/**
 * This test is auto-generated.
 * Modifications will be overwritten on every `yarn test` run!
 */
it("matches snapshot for cloud-run-non-public", async () => {
  expect(await createAllPipelines(config)).toMatchSnapshot();
});
