import { exec } from "child-process-promise";

export const getBuildId = async () =>
  await exec("git describe --tags || git rev-parse HEAD").then((s) =>
    s.stdout.trim()
  );
