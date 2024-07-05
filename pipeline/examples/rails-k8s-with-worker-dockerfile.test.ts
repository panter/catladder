import { rmSync, writeFileSync } from "fs";
import { createAllPipelines } from "./__utils__/helpers";
import config from "./rails-k8s-with-worker";

it("matches snapshot with a Dockerfile", async () => {
  writeFileSync("Dockerfile", "");
  expect(await createAllPipelines(config)).toMatchSnapshot();
  rmSync("Dockerfile");
});
