import { join } from "path";
import type { Context } from "../../types/context";
import type { GitlabJobCache } from "../../types/gitlab-types";

export const getYarnCache = (
  context: Context,
  policy = "pull-push"
): GitlabJobCache[] => {
  return [
    {
      key: "yarn",
      policy,
      paths: [".yarn"],
    },
  ];
};

export const getNodeModulesCache = (
  context: Context,
  policy = "pull-push"
): GitlabJobCache[] => {
  const componentIsInWorkspace =
    context.packageManagerInfo?.componentIsInWorkspace;

  return [
    {
      // if component is in a shared workspace, use workspace cache. use individual cache else
      key: componentIsInWorkspace
        ? "node-modules-workspace"
        : context.componentConfig.dir + "-node-modules", // we use the dirname, not the component name, because in certain cases we have two apps in the same directory and want to share the cache, e.g. when having storybook in the same package.json
      policy,
      paths: [
        ...(componentIsInWorkspace
          ? [
              "node_modules",
              ...(context.packageManagerInfo?.workspaces.map((w) =>
                join(w.location, "node_modules")
              ) ?? []),
            ]
          : [join(context.componentConfig.dir, "node_modules")]),
      ],
    },
  ];
};
export const getNodeCache = (
  context: Context,
  policy = "pull-push"
): GitlabJobCache[] => {
  return [
    ...getYarnCache(context, policy),
    ...getNodeModulesCache(context, policy),
  ];
};

export const getNextCache = (context: Context): GitlabJobCache[] => [
  {
    key: context.componentName + "-next-cache",
    policy: "pull-push",
    paths: [context.componentConfig.dir + "/.next/cache/"],
  },
];
