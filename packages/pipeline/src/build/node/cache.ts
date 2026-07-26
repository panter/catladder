import { uniq } from "lodash-es";
import { join } from "path";
import slugify from "slugify";

import type { Context } from "../../types/context";
import type { CacheConfig } from "../types";

/**
 * stable reference between the two node caches: the package-manager
 * (yarn zip / pnpm store) cache declares itself redundant when the
 * node_modules cache scored an exact-lockfile hit (github skips the
 * ~0.6GB download on warm runs)
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
 * the package manager's download cache: yarn's `.yarn` zip cache, or
 * pnpm's content-addressable store (which catladder points at a
 * project-local `.pnpm-store`, see the install script)
 */
export const getYarnCache = async (
  context: Context,
  policy = "pull-push",
): Promise<CacheConfig[]> => {
  const packageManagerInfo = await context.packageManagerInfo;
  const isPnpm = packageManagerInfo.type === "pnpm";
  const baseDir = await getCacheBaseDir(context);
  // pnpm keeps its store in a format-versioned subdir (v10, v11, ...)
  // and never cleans old ones up — scope the cache slot by major so a
  // pnpm upgrade starts a fresh slot instead of dragging the dead old
  // store tree along in every cache transfer (formats change only on
  // majors)
  const pnpmStoreKey = `pnpm-v${packageManagerInfo.version.split(".")[0]}`;
  return [
    {
      scope: "buildDir",
      pathMode: "relative",
      buildDir: baseDir,
      key: isPnpm ? pnpmStoreKey : "yarn",
      policy,
      paths: [isPnpm ? ".pnpm-store" : ".yarn"],
      // content-key for immutable-cache backends (github); the lockfile
      // decides whether the cached content could have changed
      keyFiles: [isPnpm ? "pnpm-lock.yaml" : "yarn.lock"],
      // the package manager's download cache (~hundreds of MB) is only
      // read when packages have to be (re)installed. When the
      // node_modules cache hit for the same lockfile, install verifies
      // its state file and never touches the store — so github skips
      // downloading this cache entirely
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

  const { workspaces } = packageManagerInfo;
  const isPnpm = packageManagerInfo.type === "pnpm";
  const lockFileName = isPnpm ? "pnpm-lock.yaml" : "yarn.lock";
  // yarn berry tracks install state in .yarn/install-state.gz (pnpm's
  // equivalent lives inside node_modules and is covered by the paths)
  const hasInstallState =
    packageManagerInfo.type === "yarn" && !packageManagerInfo.isClassic;

  // We intentionally do not use the contents of the lockfile as a cache key, as install should always guarantee that the files are updated, but it can still use part of the cache if not all packages are up-to-date.
  // It would slow down all pipelines whenever one adds a new dependency as it will need to download all node_modules again.
  return [
    {
      scope: "global",
      pathMode: "absolute",

      // we use the dirname, not the component name, because in certain cases we have two apps in the same directory and want to share the cache, e.g. when having storybook in the same package.json
      //
      // pnpm gets its own, lockfile-keyed cache: node_modules layouts
      // are not compatible between package managers (a migrating
      // project must not inherit the yarn slot), and unlike yarn, a
      // pnpm install on top of a node_modules from a different lockfile
      // leaves orphaned .pnpm dirs behind that break type identity —
      // so the slot changes whenever the lockfile changes
      key: isPnpm
        ? {
            prefix: "pnpm-" + slugify(baseDir) + "-node-modules",
            files: [join(baseDir, "pnpm-lock.yaml")],
          }
        : slugify(baseDir) + "-node-modules",
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
        // pnpm's per-package node_modules are symlink farms worth
        // keeping warm (yarn hoists into the root, so root-only
        // matches its historical behavior)
        ...(isPnpm
          ? workspaces.map((w) => join(w.location, "node_modules"))
          : []),
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
