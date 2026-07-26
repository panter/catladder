import { exec } from "child-process-promise";
import { existsSync, readFileSync } from "fs";
import { readFile } from "fs/promises";
import { join, relative } from "path";
import memoizee from "memoizee";
import { parse } from "yaml";
import type { YarnWorkspace } from "../../types";
import { jsonParseOrThrow } from "../../utils/jsonParse";

type PnpmProject = {
  name: string;
  path: string;
  private?: boolean;
};

const readWorkspaceDependencyLocations = async (
  location: string,
  locationByName: Map<string, string>,
): Promise<string[]> => {
  try {
    const pkg = JSON.parse(
      await readFile(join(location, "package.json"), "utf-8"),
    );
    const depNames = [
      ...Object.keys(pkg.dependencies ?? {}),
      ...Object.keys(pkg.devDependencies ?? {}),
      ...Object.keys(pkg.optionalDependencies ?? {}),
    ];
    return [
      ...new Set(
        depNames
          .map((name) => locationByName.get(name))
          .filter((l): l is string => Boolean(l) && l !== location),
      ),
    ];
  } catch {
    return [];
  }
};

/**
 * patch files referenced by `patchedDependencies` (pnpm-workspace.yaml
 * or the root package.json's `pnpm` section) — they must travel into
 * the docker build context, or the prod install fails to verify them
 */
export const getPnpmPatchFiles = (root = "."): string[] => {
  const patchedDependencies: Record<string, string> = {};
  try {
    const ws = parse(readFileSync(join(root, "pnpm-workspace.yaml"), "utf-8"));
    Object.assign(patchedDependencies, ws?.patchedDependencies ?? {});
  } catch {
    // no workspace file
  }
  try {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf-8"));
    Object.assign(patchedDependencies, pkg?.pnpm?.patchedDependencies ?? {});
  } catch {
    // no package.json
  }
  return [
    ...new Set(
      Object.values(patchedDependencies)
        .map((p) => join(root, p))
        .filter((p) => existsSync(p)),
    ),
  ];
};

/**
 * list pnpm workspace projects in the same shape yarn berry reports them
 * (locations relative to the project root, workspace dependencies as
 * locations). Outside a pnpm workspace this returns [].
 */
// export for mocking
export const getPnpmWorkspaces = memoizee(
  async (): Promise<Array<YarnWorkspace>> => {
    let output: string;
    try {
      output = (await exec("pnpm m ls --json --depth -1")).stdout;
    } catch {
      return [];
    }
    const projects: PnpmProject[] = jsonParseOrThrow(output.trim() || "[]");
    if (!Array.isArray(projects)) return [];

    const withLocations = projects
      .filter((p) => p.name && p.path)
      .map((p) => ({
        name: p.name,
        location: relative(process.cwd(), p.path) || ".",
      }));
    const locationByName = new Map(
      withLocations.map((p) => [p.name, p.location]),
    );

    return Promise.all(
      withLocations.map(async ({ name, location }) => ({
        name,
        location,
        workspaceDependencies: await readWorkspaceDependencyLocations(
          location,
          locationByName,
        ),
        mismatchedWorkspaceDependencies: [],
      })),
    );
  },
  { promise: true },
);
