import { mkdir, rm, writeFile } from "fs/promises";
import { createYamlLocalPipeline } from "./__utils__/helpers";
import config from "./rails-k8s-with-worker";
import { merge } from "lodash-es";
import { join } from "path";

it("matches snapshot with a Dockerfile", async () => {
  const appDir = ".temp-with-dockerfile";
  try {
    await rm(appDir, {
      recursive: true,
    });
  } catch (e) {
    // ignore
  }
  await mkdir(appDir);
  await writeFile(join(appDir, "Dockerfile"), "");
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

  await rm(appDir, {
    recursive: true,
  });
});
