import { createAllPipelines } from "./__utils__/helpers";
import config from "./kubernetes-with-jobs";

/**
 * This test is auto-generated.
 * Modifications will be overwritten on every `yarn test` run!
 */
it("matches snapshot for kubernetes-with-jobs", async () => {
  expect(await createAllPipelines(config)).toMatchSnapshot();
});
