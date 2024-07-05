import { createAllPipelines } from "./__utils__/helpers";
import config from "./git-submodule";

/**
 * This test is auto-generated.
 * Modifications will be overwritten on every `yarn test` run!
 */
it("matches snapshot for git-submodule", async () => {
  expect(await createAllPipelines(config)).toMatchSnapshot();
});
