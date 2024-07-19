import { mkdirSync, rmSync, writeFileSync } from "fs";
import { createYamlLocalPipeline } from "./__utils__/helpers";
import config from "./rails-k8s-with-worker";
import { merge } from "lodash";
import { join } from "path";

it("matches snapshot with a Dockerfile", async () => {
  const appDir = ".temp-with-dockerfile";
  mkdirSync(appDir);
  writeFileSync(join(appDir, "Dockerfile"), "");
  expect(
    await createYamlLocalPipeline(
      merge(config, {
        components: {
          app: {
            dir: appDir,
          },
        },
      }),
    ),
  ).toMatchSnapshot();

  rmSync(appDir, {
    recursive: true,
  });
});
