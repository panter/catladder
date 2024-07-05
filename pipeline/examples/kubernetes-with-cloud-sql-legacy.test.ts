import { createAllPipelines } from "./__utils__/helpers";
import config from "./kubernetes-with-cloud-sql-legacy";

/**
 * This test is auto-generated.
 * Modifications will be overwritten on every `yarn test` run!
 */
it("matches snapshot for kubernetes-with-cloud-sql-legacy", async () => {
  expect(await createAllPipelines(config)).toMatchSnapshot();
});
