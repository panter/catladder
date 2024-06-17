import { join } from "path";
import slugify from "slugify";
import type { ComponentContext } from "../../types/context";
import type { GitlabJobCache } from "../../types/gitlab-types";
import { uniq } from "lodash";

export const getYarnCache = (
  context: ComponentContext,
  policy = "pull-push",
): GitlabJobCache[] => {
  const componentIsInWorkspace =
    context.packageManagerInfo?.componentIsInWorkspace;
  return [
    componentIsInWorkspace
      ? {
          key: "yarn",
          policy,
          paths: [".yarn"],
        }
      : {
          key: slugify(context.componentConfig.dir) + "-yarn",
          policy,
          paths: [join(context.componentConfig.dir, ".yarn")],
        },
  ];
};

export const getNodeModulesCache = (
  context: ComponentContext,
  policy = "pull-push",
): GitlabJobCache[] => {
  const componentIsInWorkspace =
    context.packageManagerInfo?.componentIsInWorkspace;

  // We intentionally do not use the contents of yarn.lock as a cache key, as yarn install should always guarantee that the files are updated, but it can still use part of the cache if not all packages are up-to-date.
  // It would slow down all pipelines whenever one adds a new dependency as it will need to download all node_modules again.
  return [
    {
      // if component is in a shared workspace, use workspace cache. use individual cache else
      key: componentIsInWorkspace
        ? "node-modules-workspace"
        : slugify(context.componentConfig.dir) + "-node-modules", // we use the dirname, not the component name, because in certain cases we have two apps in the same directory and want to share the cache, e.g. when having storybook in the same package.json
      policy,
      paths: [
        ...(componentIsInWorkspace
          ? uniq([
              "node_modules",
              ...(context.packageManagerInfo?.workspaces.map((w) =>
                join(w.location, "node_modules"),
              ) ?? []),
            ])
          : [join(context.componentConfig.dir, "node_modules")]),
      ],
    },
  ];
};
export const getNodeCache = (
  context: ComponentContext,
  policy = "pull-push",
): GitlabJobCache[] => {
  return [
    ...getYarnCache(context, policy),
    ...getNodeModulesCache(context, policy),
  ];
};

export const getNextCache = (context: ComponentContext): GitlabJobCache[] => [
  {
    key: context.componentName + "-next-cache",
    policy: "pull-push",
    paths: [context.componentConfig.dir + "/.next/cache/"],
  },
];
