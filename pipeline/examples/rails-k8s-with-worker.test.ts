import { createAllPipelines } from "./__utils__/helpers";
import config from "./rails-k8s-with-worker";

/**
 * This test is auto-generated.
 * Modifications will be overwritten on every `yarn test` run!
 */
it("matches snapshot for rails-k8s-with-worker", async () => {
  expect(await createAllPipelines(config)).toMatchSnapshot();
});
