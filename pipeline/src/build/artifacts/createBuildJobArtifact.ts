import { join } from "path";
import {
  componentContextIsStandaloneBuild,
  type ComponentContext,
  type Context,
} from "../../types";
import type { CatladderJob } from "../../types/jobs";
import { uniq } from "lodash";
import { componentContextNeedsBuildTimeDotEnv } from "../base/writeDotEnv";

const uniqueAndAlphabeticalSort = (arr: string[]): string[] => {
  return uniq(arr).sort((a, b) => a.localeCompare(b));
};
export const createBuildJobArtifacts = async (
  context: Context,
): Promise<CatladderJob["artifacts"]> => {
  const paths =
    context.type === "workspace"
      ? (
          await Promise.all(
            context.components.map((c) => getArtifactsPathForComponent(c)),
          )
        ).flat()
      : await getArtifactsPathForComponent(context, ["__build_info.json"]);

  const exclude =
    context.type === "workspace"
      ? (
          await Promise.all(
            context.components.map((c) =>
              getAllArtifactExcludePathsForComponent(c),
            ),
          )
        ).flat()
      : await getAllArtifactExcludePathsForComponent(context);
  return {
    paths: uniqueAndAlphabeticalSort(paths),
    ...(exclude.length > 0
      ? { exclude: uniqueAndAlphabeticalSort(exclude) }
      : {}),
    expire_in: "1 day",
    when: "always",
    reports:
      // TODO: support for junit reports in other builds
      context.type === "component" && componentContextIsStandaloneBuild(context)
        ? {
            junit: context.build.config.artifactsReports?.junit?.map((p) =>
              join(context.build.dir, p),
            ),
          }
        : {},
  };
};
const _getArtifactPathsForComponent = async (
  c: ComponentContext,
  configKey: "artifactsPaths" | "artifactsExcludePaths",
  additionalPaths?: string[],
): Promise<string[]> => {
  // in theory, we only need "direct",
  // but in some cases project may have packages in the workspace that create build artifacts, which aren't components
  // this highly depends on the build tool. To be safe, we get all
  const componentDirs = await c.build.getComponentDirs("all");
  return [
    ...(c.build.type !== "disabled" ? (c.build.config[configKey] ?? []) : []),
    ...(additionalPaths ?? []),
  ]?.flatMap((artifact) =>
    componentDirs.flatMap((cDir: string) => join(cDir, artifact)),
  );
};

const getArtifactsPathForComponent = (
  c: ComponentContext,
  additionalPaths?: string[],
): Promise<string[]> => {
  return _getArtifactPathsForComponent(c, "artifactsPaths", additionalPaths);
};

const getAllArtifactExcludePathsForComponent = async (
  c: ComponentContext,
): Promise<string[]> => {
  return [
    ...getDotEnvPathsForComponent(c), // always exclude .env files
    ...(await getArtifactExcludePathsForComponent(c)),
  ];
};

const getArtifactExcludePathsForComponent = (
  c: ComponentContext,
  additionalPaths?: string[],
): Promise<string[]> => {
  return _getArtifactPathsForComponent(
    c,
    "artifactsExcludePaths",
    additionalPaths,
  );
};

const getDotEnvPathsForComponent = (c: ComponentContext): string[] => {
  if (componentContextNeedsBuildTimeDotEnv(c)) {
    return [join(c.build.dir, ".env")];
  }
  return [];
};
