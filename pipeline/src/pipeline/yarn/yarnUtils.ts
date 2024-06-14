import { exec } from "child-process-promise";
import memoizee from "memoizee";
import type { PackageManagerInfo, YarnWorkspace } from "../../types";

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
  { promise: true },
);
// export for mocking
export const getWorkspaces = memoizee(
  async (isClassic: boolean): Promise<PackageManagerInfo["workspaces"]> => {
    return isClassic
      ? Object.values(
          JSON.parse(
            JSON.parse(await execOrFail("yarn workspaces --json info", "{}"))
              ?.data ?? "{}",
          ),
        )
      : JSON.parse(
          `[${(await execOrFail("yarn workspaces list --json --verbose", ""))
            .trim()
            .split("\n")
            .join(",")}]`,
        );
  },
  { promise: true },
);

// recursivly get all workspace dependencies
export const getWorkspaceDependencies = (
  ws: YarnWorkspace,
  allWorkspaces: YarnWorkspace[],
): string[] => {
  return ws
    ? ([...ws.workspaceDependencies, ...ws.mismatchedWorkspaceDependencies]
        .flatMap((location) => {
          // we have to do this recursivly

          const otherWorkspace = allWorkspaces.find(
            (w) => w.location === location,
          );

          if (otherWorkspace) {
            return [
              ...getWorkspaceDependencies(otherWorkspace, allWorkspaces),
              otherWorkspace.location,
            ];
          }
          return [];
        })
        .filter(Boolean) as string[])
    : [];
};
