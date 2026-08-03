import type { PackageManagerType } from "../types/context";

/**
 * run a package.json script with the project's package manager
 * (`yarn build` / `pnpm build`)
 */
export const runScript = (packageManager: PackageManagerType, script: string) =>
  `${packageManager} ${script}`;
