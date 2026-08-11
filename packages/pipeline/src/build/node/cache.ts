import { uniq } from "lodash-es";
import { join } from "path";
import slugify from "slugify";

import type { Context } from "../../types/context";
import type { CacheConfig } from "../types";

/**
 * stable reference between the two yarn caches: the zip cache declares
 * itself redundant when the node_modules cache scored an exact-lockfile
 * hit (github skips the ~0.6GB download on warm runs)
 */
const NODE_MODULES_CACHE_ID = "node-modules";

/**
 * the directory whose caches this job uses. Components that are part of
 * a shared workspace use the workspace root's caches: the install
 * operates on the whole workspace, and the workspace build job is the
 * one that populates the slots. Historically these component jobs
 * (verify, docker) read a separate key family that no job ever saved,
 * so they always started cold. Standalone components and the workspace
 * jobs themselves keep using their own build dir (unchanged keys).
 */
const getCacheBaseDir = async (context: Context): Promise<string> => {
  const packageManagerInfo = await context.packageManagerInfo;
  const componentIsInWorkspace =
    context.type === "component" &&
    "componentIsInWorkspace" in packageManagerInfo &&
    packageManagerInfo.componentIsInWorkspace;
  if (!componentIsInWorkspace) return context.build.dir;
  // the workspace build's dir when the component references one,
  // otherwise the repo root (packageManager.ts resolves workspace
  // membership against the root)
  return context.build.type === "fromWorkspace"
    ? (context.build.workspaceBuildConfig.dir ?? ".")
    : ".";
};

/**
 * the package manager's download cache: yarn's `.yarn` zip cache.
 *
 * pnpm gets nothing. Its store is a content-addressable tree of
 * hundreds of thousands of small files, and moving it costs more than
 * the install it saves: measured on a 3800-package monorepo, restoring
 * the 1 GB store took ~53s on gitlab (which zips file by file) and
 * ~23s on github, against a from-registry install of ~30-40s. See
 * getNodeModulesCache for the node_modules half of the same finding.
 */
export const getYarnCache = async (
  context: Context,
  policy = "pull-push",
): Promise<CacheConfig[]> => {
  const packageManagerInfo = await context.packageManagerInfo;
  if (packageManagerInfo.type === "pnpm") return [];
  const baseDir = await getCacheBaseDir(context);
  return [
    {
      scope: "buildDir",
      pathMode: "relative",
      buildDir: baseDir,
      key: "yarn",
      policy,
      paths: [".yarn"],
      // content-key for immutable-cache backends (github); the lockfile
      // decides whether the cached content could have changed
      keyFiles: ["yarn.lock"],
      // the yarn zip cache (~hundreds of MB) is only read when packages
      // have to be (re)installed. When the node_modules cache hit for
      // the same lockfile, install verifies its state file and never
      // touches the zips — so github skips downloading this cache
      // entirely
      redundantOnExactHitOf: NODE_MODULES_CACHE_ID,
    },
  ];
};

export const getNodeModulesCache = async (
  context: Context,
  policy = "pull-push",
): Promise<CacheConfig[]> => {
  const packageManagerInfo = await context.packageManagerInfo;
  const baseDir = await getCacheBaseDir(context);

  // pnpm gets no node_modules cache either: archiving the tree (root
  // plus every workspace's symlink farm, >1GB in real monorepos) costs
  // ~190s per saving job to spare ~6s of install, and a safe pnpm slot
  // must be keyed by lockfile hash (a pnpm install over a node_modules
  // from a different lockfile leaves orphaned .pnpm dirs that break
  // type identity), so it misses on every dependency change anyway.
  // pnpm projects run entirely uncached — see getYarnCache
  if (packageManagerInfo.type === "pnpm") return [];

  const lockFileName = "yarn.lock";
  // yarn berry tracks install state in .yarn/install-state.gz
  const hasInstallState = !packageManagerInfo.isClassic;

  // We intentionally do not use the contents of the lockfile as a cache key, as install should always guarantee that the files are updated, but it can still use part of the cache if not all packages are up-to-date.
  // It would slow down all pipelines whenever one adds a new dependency as it will need to download all node_modules again.
  return [
    {
      scope: "global",
      pathMode: "absolute",

      // we use the dirname, not the component name, because in certain cases we have two apps in the same directory and want to share the cache, e.g. when having storybook in the same package.json
      key: slugify(baseDir) + "-node-modules",
      // content-key for immutable-cache backends (github); the lockfile
      // decides whether the cached content could have changed (absolute
      // pathMode: resolve the lockfile explicitly)
      keyFiles: [join(baseDir, lockFileName)],
      // referenced by the package-manager cache: an exact hit here makes
      // it unnecessary (see redundantOnExactHitOf on getYarnCache)
      cacheId: NODE_MODULES_CACHE_ID,
      policy,
      paths: uniq([
        join(baseDir, "node_modules"),
        ...(hasInstallState ? [join(baseDir, ".yarn/install-state.gz")] : []),
      ]),
    },
  ];
};
export const getNodeCache = async (
  context: Context,
  policy = "pull-push",
): Promise<CacheConfig[]> => {
  return [
    ...(await getYarnCache(context, policy)),
    ...(await getNodeModulesCache(context, policy)),
  ];
};
