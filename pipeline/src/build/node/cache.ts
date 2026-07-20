import { uniq } from "lodash-es";
import { join } from "path";
import slugify from "slugify";

import type { Context, WorkspaceContext } from "../../types/context";
import type { CacheConfig } from "../types";

/**
 * stable reference between the two node caches: the yarn (zip) cache
 * declares itself redundant when the node_modules cache scored an
 * exact-lockfile hit (github skips the ~0.6GB download on warm runs)
 */
const NODE_MODULES_CACHE_ID = "node-modules";

export const getYarnCache = async (
  context: Context,
  policy = "pull-push",
): Promise<CacheConfig[]> => {
  const packageManagerInfo = await context.packageManagerInfo;
  const componentIsInWorkspace =
    context.type === "component" &&
    "componentIsInWorkspace" in packageManagerInfo &&
    packageManagerInfo.componentIsInWorkspace;
  return [
    {
      scope: componentIsInWorkspace ? "global" : "buildDir",
      pathMode: componentIsInWorkspace ? "absolute" : "relative",
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
  const componentIsInWorkspace =
    context.type === "component" &&
    "componentIsInWorkspace" in packageManagerInfo &&
    packageManagerInfo.componentIsInWorkspace;

  const { isClassic, workspaces } = packageManagerInfo;

  // We intentionally do not use the contents of yarn.lock as a cache key, as yarn install should always guarantee that the files are updated, but it can still use part of the cache if not all packages are up-to-date.
  // It would slow down all pipelines whenever one adds a new dependency as it will need to download all node_modules again.
  return [
    {
      scope: "global",
      pathMode: "absolute",

      // if component is in a shared workspace, use workspace cache. use individual cache else
      key: componentIsInWorkspace
        ? "node-modules-workspace"
        : slugify(context.build.dir) + "-node-modules", // we use the dirname, not the component name, because in certain cases we have two apps in the same directory and want to share the cache, e.g. when having storybook in the same package.json
      // content-key for immutable-cache backends (github); the lockfile
      // decides whether the cached content could have changed (absolute
      // pathMode: resolve the standalone component's lockfile explicitly)
      keyFiles: [
        componentIsInWorkspace
          ? "yarn.lock"
          : join(context.build.dir, "yarn.lock"),
      ],
      // referenced by the yarn cache: an exact hit here makes the yarn
      // zips unnecessary (see redundantOnExactHitOf on getYarnCache)
      cacheId: NODE_MODULES_CACHE_ID,
      policy,
      paths: [
        ...(componentIsInWorkspace
          ? uniq([
              "node_modules",
              ...(workspaces.map((w) => join(w.location, "node_modules")) ??
                []),
              ...(!isClassic
                ? [
                    ".yarn/install-state.gz",
                    ...(workspaces.map((w) =>
                      join(w.location, ".yarn/install-state.gz"),
                    ) ?? []),
                  ]
                : []),
            ])
          : [
              join(context.build.dir, "node_modules"),
              ...(!isClassic
                ? [join(context.build.dir, ".yarn/install-state.gz")]
                : []),
            ]),
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
