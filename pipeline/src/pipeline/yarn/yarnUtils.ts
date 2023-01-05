import { exec } from "child-process-promise";
import memoizee from "memoizee";
import type { PackageManagerInfo } from "../../types";

const execOrFail = async (cmd: string, onFail: string): Promise<string> => {
  try {
    return await exec(cmd).then((r) => r.stdout);
  } catch (e) {
    return onFail ?? null;
  }
};
// export for mocking
export const getYarnVersion = memoizee(
  async () => {
    return await execOrFail("yarn --version", "");
  },
  { promise: true }
);
// export for mocking
export const getWorkspaces = memoizee(
  async (isClassic: boolean): Promise<PackageManagerInfo["workspaces"]> => {
    return isClassic
      ? Object.values(
          JSON.parse(
            JSON.parse(await execOrFail("yarn workspaces --json info", "{}"))
              ?.data ?? "{}"
          )
        )
      : JSON.parse(
          `[${(await execOrFail("yarn workspaces list --json --verbose", ""))
            .trim()
            .split("\n")
            .join(",")}]`
        );
  },
  { promise: true }
);
