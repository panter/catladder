import { exec } from "child-process-promise";
import memoizee from "memoizee";
import type { YarnWorkspace } from "../../types";
import { jsonParseOrThrow } from "../../utils/jsonParse";

const execOrFail = async (cmd: string, onFail: string): Promise<string> => {
  try {
    return await exec(cmd).then((r) => r.stdout);
  } catch (e) {
    return onFail ?? null;
  }
};

// export for mocking
export const getWorkspaces = memoizee(
  async (isClassic: boolean): Promise<Array<YarnWorkspace>> => {
    return isClassic
      ? Object.values(
          jsonParseOrThrow(
            jsonParseOrThrow(
              await execOrFail("yarn workspaces --json info", "{}"),
            )?.data ?? "{}",
          ),
        )
      : jsonParseOrThrow(
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
