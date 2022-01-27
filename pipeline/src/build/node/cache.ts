import { join } from "path";
import { Context } from "../../types/context";
import { GitlabJobCache } from "../../types/gitlab-types";

export const getNodeCache = (context: Context): GitlabJobCache[] => {
  const componentIsInWorkspace = context.yarnInfo?.componentIsInWorkspace;

  return [
    {
      // if component is in a shared workspace, use workspace cache. use individual cache else
      key: componentIsInWorkspace
        ? "node-modules-workspace"
        : context.componentName + "-node-modules",
      policy: "pull-push",
      paths: [
        ".yarn",
        ...(componentIsInWorkspace
          ? [
              "node_modules",
              ...(context.yarnInfo?.workspaces.map((w) =>
                join(w.location, "node_modules")
              ) ?? []),
            ]
          : [join(context.componentConfig.dir, "node_modules")]),
      ],
    },
  ];
};

export const getNextCache = (context: Context): GitlabJobCache[] => [
  {
    key: context.componentName + "-next-cache",
    policy: "pull-push",
    paths: [context.componentConfig.dir + "/.next/cache/"],
  },
];
