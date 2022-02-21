import { exec } from "child-process-promise";
import { Config, YarnInfo } from "../types";
import { pathEqual } from "path-equal";
import memoizee from "memoizee";
import { join } from "path";
import { existsSync } from "fs";

const execOrFail = async (cmd: string, onFail: string): Promise<string> => {
  try {
    return await exec(cmd).then((r) => r.stdout);
  } catch (e) {
    return onFail ?? null;
  }
};

const getYarnVersion = memoizee(
  async () => {
    return await execOrFail("yarn --version", "");
  },
  { promise: true }
);

const getWorkspaces = memoizee(
  async (isClassic: boolean): Promise<YarnInfo["workspaces"]> => {
    return isClassic
      ? Object.values(
          JSON.parse(
            JSON.parse(await execOrFail("yarn workspaces --json info", "{}"))
              ?.data ?? "{}"
          )
        )
      : JSON.parse(`[${await execOrFail("yarn workspaces list --json", "")}]`);
  },
  { promise: true }
);
export const getYarnInfo = async (
  config: Config,
  componentName: string
): Promise<YarnInfo> => {
  const version = await getYarnVersion();
  if (!version) throw new Error("could not get yarn version");
  const isClassic = version.startsWith("1");

  const component = config.components[componentName];
  const workspaces = await getWorkspaces(isClassic);
  const componentIsInWorkspace = workspaces.some((w) =>
    pathEqual(component.dir, w.location)
  );
  const packageJson = join(component.dir, "package.json");
  const lockFile = componentIsInWorkspace
    ? "yarn.lock"
    : join(component.dir, "yarn.lock");
  const RC_FILES = [".yarnrc", ".npmrc"];
  const possibleRcFiles = componentIsInWorkspace
    ? RC_FILES
    : RC_FILES.map((f) => join(component.dir, f));
  const files = [packageJson, lockFile, ...possibleRcFiles].filter((f) =>
    existsSync(f)
  );

  return {
    workspaces,
    version,
    isClassic,
    componentIsInWorkspace,
    files,
  };
};
