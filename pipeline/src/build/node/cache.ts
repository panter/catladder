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
        : context.componentConfig.dir + "-node-modules", // we use the dirname, not the component name, because in certain cases we have two apps in the same directory and want to share the cache, e.g. when having storybook in the same package.json
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
