import { join } from "path";
import slugify from "slugify";

import type { Context } from "../../types/context";
import type { CacheConfig } from "../types";

/**
 * stable reference between the two node caches: the yarn (zip) cache
 * declares itself redundant when the node_modules cache scored an
 * exact-lockfile hit (github skips the ~0.6GB download on warm runs)
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

export const getYarnCache = async (
  context: Context,
  policy = "pull-push",
): Promise<CacheConfig[]> => {
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
      // the .yarn zips (~hundreds of MB) are only read when yarn has to
      // (re)install packages. When the node_modules cache hit for the
      // same lockfile, install verifies via install-state.gz and never
      // opens a zip — so github skips downloading this cache entirely
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

  const { isClassic } = packageManagerInfo;

  // We intentionally do not use the contents of yarn.lock as a cache key, as yarn install should always guarantee that the files are updated, but it can still use part of the cache if not all packages are up-to-date.
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
      keyFiles: [join(baseDir, "yarn.lock")],
      // referenced by the yarn cache: an exact hit here makes the yarn
      // zips unnecessary (see redundantOnExactHitOf on getYarnCache)
      cacheId: NODE_MODULES_CACHE_ID,
      policy,
      paths: [
        join(baseDir, "node_modules"),
        ...(!isClassic ? [join(baseDir, ".yarn/install-state.gz")] : []),
      ],
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
