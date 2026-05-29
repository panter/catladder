import { uniq } from "lodash-es";
import { join } from "path";
import slugify from "slugify";

import type { Context, WorkspaceContext } from "../../types/context";
import type { CacheConfig } from "../types";

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
