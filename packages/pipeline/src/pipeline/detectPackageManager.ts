import { exec } from "child-process-promise";
import { existsSync } from "fs";
import { readFile } from "fs/promises";
import { join } from "path";
import memoizee from "memoizee";
import type { PackageManagerType } from "../types/context";

export type DetectedPackageManager = {
  type: PackageManagerType;
  version: string;
};

const readPackageManagerField = async (
  dir: string,
): Promise<DetectedPackageManager | null> => {
  try {
    const pkg = JSON.parse(await readFile(join(dir, "package.json"), "utf-8"));
    const match = /^(yarn|pnpm)@(.+)$/.exec(pkg.packageManager);
    if (!match) return null;
    return { type: match[1] as PackageManagerType, version: match[2] };
  } catch {
    return null;
  }
};

const detectByLockfile = (dir: string): PackageManagerType | null => {
  if (existsSync(join(dir, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(join(dir, "yarn.lock"))) return "yarn";
  return null;
};

const getGitRoot = async (): Promise<string | null> => {
  try {
    return (await exec("git rev-parse --show-toplevel")).stdout.trim();
  } catch {
    return null;
  }
};

const getInstalledVersion = async (
  type: PackageManagerType,
): Promise<string> => {
  try {
    return (await exec(`${type} --version`)).stdout.trim();
  } catch {
    return "";
  }
};

/**
 * detect which package manager the project uses (and its version).
 *
 * Order: the `packageManager` field in package.json (cwd, then git root)
 * wins, then the lockfile present (pnpm-lock.yaml → pnpm, yarn.lock →
 * yarn), then falling back to yarn (the historical default).
 *
 * An `explicitType` (from `packageManager` in catladder.ts) overrides the
 * detected type; the version is still taken from the `packageManager`
 * field when it pins the same manager, otherwise from the installed CLI.
 */
export const detectPackageManager = memoizee(
  async (
    explicitType?: PackageManagerType,
  ): Promise<DetectedPackageManager> => {
    const roots = [process.cwd()];
    const gitRoot = await getGitRoot();
    if (gitRoot && gitRoot !== process.cwd()) roots.push(gitRoot);

    let fromField: DetectedPackageManager | null = null;
    for (const root of roots) {
      fromField = await readPackageManagerField(root);
      if (fromField) break;
    }

    const detectedType =
      explicitType ??
      fromField?.type ??
      roots.map(detectByLockfile).find(Boolean) ??
      "yarn";

    const version =
      fromField?.type === detectedType
        ? fromField.version
        : await getInstalledVersion(detectedType);

    return { type: detectedType, version };
  },
  { promise: true },
);
