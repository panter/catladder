import { uniq } from "lodash";
import { join } from "path";
import slugify from "slugify";
import type { Context } from "../../types/context";
import type { GitlabJobCache } from "../../types/gitlab-types";

export const getYarnCache = (
  context: Context,
  policy = "pull-push",
): GitlabJobCache[] => {
  const componentIsInWorkspace =
    context.type === "component" &&
    context.packageManagerInfo.componentIsInWorkspace;
  return [
    componentIsInWorkspace
      ? {
          key: "yarn",
          policy,
          paths: [".yarn"],
        }
      : {
          key: slugify(context.build.dir) + "-yarn",
          policy,
          paths: [join(context.build.dir, ".yarn")],
        },
  ];
};

export const getNodeModulesCache = (
  context: Context,
  policy = "pull-push",
): GitlabJobCache[] => {
  const componentIsInWorkspace =
    context.type === "component" &&
    context.packageManagerInfo.componentIsInWorkspace;

  // We intentionally do not use the contents of yarn.lock as a cache key, as yarn install should always guarantee that the files are updated, but it can still use part of the cache if not all packages are up-to-date.
  // It would slow down all pipelines whenever one adds a new dependency as it will need to download all node_modules again.
  return [
    {
      // if component is in a shared workspace, use workspace cache. use individual cache else
      key: componentIsInWorkspace
        ? "node-modules-workspace"
        : slugify(context.build.dir) + "-node-modules", // we use the dirname, not the component name, because in certain cases we have two apps in the same directory and want to share the cache, e.g. when having storybook in the same package.json
      policy,
      paths: [
        ...(componentIsInWorkspace
          ? uniq([
              "node_modules",
              ...(context.packageManagerInfo.workspaces.map((w) =>
                join(w.location, "node_modules"),
              ) ?? []),
            ])
          : [join(context.build.dir, "node_modules")]),
      ],
    },
  ];
};
export const getNodeCache = (
  context: Context,
  policy = "pull-push",
): GitlabJobCache[] => {
  return [
    ...getYarnCache(context, policy),
    ...getNodeModulesCache(context, policy),
  ];
};

export const getNextCache = (context: Context): GitlabJobCache[] => {
  const key = context.name + "-next-cache";
  const paths = context.build
    .getComponentDirs("direct")
    .map((c) => join(c, ".next/cache"));

  return [
    {
      key,
      policy: "pull-push",
      paths,
    },
  ];
};
