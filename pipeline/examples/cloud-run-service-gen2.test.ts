import { createAllPipelines } from "./__utils__/helpers";
import config from "./cloud-run-service-gen2";

/**
 * This test is auto-generated.
 * Modifications will be overwritten on every `yarn test` run!
 */
it("matches snapshot for cloud-run-service-gen2", async () => {
  expect(await createAllPipelines(config)).toMatchSnapshot();
});
