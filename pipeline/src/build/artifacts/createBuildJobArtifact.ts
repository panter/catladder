import { join } from "path";
import {
  componentContextIsStandaloneBuild,
  type ComponentContext,
  type Context,
} from "../../types";
import type { CatladderJob } from "../../types/jobs";
import { uniq } from "lodash";
import { componentContextNeedsBuildTimeDotEnv } from "../base/writeDotEnv";

export const createBuildJobArtifacts = (
  context: Context,
): CatladderJob["artifacts"] => {
  const paths =
    context.type === "workspace"
      ? context.components.flatMap((c) => getArtifactsPathForComponent(c))
      : getArtifactsPathForComponent(context, ["__build_info.json"]);

  const exclude =
    context.type === "workspace"
      ? context.components.flatMap((c) =>
          getAllArtifactExcludePathsForComponent(c),
        )
      : getAllArtifactExcludePathsForComponent(context);
  return {
    paths: uniq(paths).sort((a, b) => a.localeCompare(b)),
    ...(exclude.length > 0 ? { exclude } : {}),
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
const _getArtifactPathsForComponent = (
  c: ComponentContext,
  configKey: "artifactsPaths" | "artifactsExcludePaths",
  additionalPaths?: string[],
): string[] => {
  return [
    ...(c.build.type !== "disabled" ? (c.build.config[configKey] ?? []) : []),
    ...(additionalPaths ?? []),
  ]?.flatMap((artifact) =>
    c.build
      // in theory, we only need "direct",
      // but in some cases project may have packages in the workspace that create build artifacts, which aren't components
      // this highly depends on the build tool. To be safe, we get all
      .getComponentDirs("all")
      .flatMap((cDir) => join(cDir, artifact)),
  );
};

const getArtifactsPathForComponent = (
  c: ComponentContext,
  additionalPaths?: string[],
): string[] => {
  return _getArtifactPathsForComponent(c, "artifactsPaths", additionalPaths);
};

const getAllArtifactExcludePathsForComponent = (
  c: ComponentContext,
): string[] => {
  return [
    ...getDotEnvPathsForComponent(c), // always exclude .env files
    ...getArtifactExcludePathsForComponent(c),
  ];
};

const getArtifactExcludePathsForComponent = (
  c: ComponentContext,
  additionalPaths?: string[],
): string[] => {
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
