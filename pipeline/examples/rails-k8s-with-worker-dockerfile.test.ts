import { rmSync, writeFileSync } from "fs";
import { createYamlLocalPipeline } from "./__utils__/helpers";
import config from "./rails-k8s-with-worker";

it("matches snapshot with a Dockerfile", async () => {
  writeFileSync("Dockerfile", "");
  expect(await createYamlLocalPipeline(config)).toMatchSnapshot();
  rmSync("Dockerfile");
});
