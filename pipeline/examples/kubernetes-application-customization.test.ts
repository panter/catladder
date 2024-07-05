import { createAllPipelines } from "./__utils__/helpers";
import config from "./kubernetes-application-customization";

/**
 * This test is auto-generated.
 * Modifications will be overwritten on every `yarn test` run!
 */
it("matches snapshot for kubernetes-application-customization", async () => {
  expect(await createAllPipelines(config)).toMatchSnapshot();
});
