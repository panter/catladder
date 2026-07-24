import { exec } from "child-process-promise";
import { readFile } from "fs/promises";
import { join } from "path";
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

const readPackageManagerVersion = async (
  dir: string,
): Promise<string | null> => {
  try {
    const pkg = JSON.parse(await readFile(join(dir, "package.json"), "utf-8"));
    const match = /^yarn@(.+)$/.exec(pkg.packageManager);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
};

const getGitRoot = async (): Promise<string | null> => {
  try {
    return (await exec("git rev-parse --show-toplevel")).stdout.trim();
  } catch {
    return null;
  }
};

// export for mocking
export const getYarnVersion = memoizee(
  async () => {
    // Fast path: read from package.json packageManager field
    const fromCwd = await readPackageManagerVersion(process.cwd());
    if (fromCwd) return fromCwd;

    const gitRoot = await getGitRoot();
    if (gitRoot && gitRoot !== process.cwd()) {
      const fromGitRoot = await readPackageManagerVersion(gitRoot);
      if (fromGitRoot) return fromGitRoot;
    }

    // Fallback: invoke yarn CLI
    return await execOrFail("yarn --version", "");
  },
  { promise: true },
);

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
