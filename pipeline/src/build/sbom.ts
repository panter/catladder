import { isStandaloneBuildConfig } from ".";
import type { ComponentContextWithBuild } from "../types/context";
import type { CatladderJob } from "../types/jobs";
import { ensureArrayOrNull } from "../utils";

export const SBOM_BUILD_JOB_NAME = "🧾 sbom";
export const SBOM_FILE = "__sbom.json";

export const createSbomBuildJob = (
  context: ComponentContextWithBuild,
): CatladderJob => {
  const buildConfig = context.build.config;

  const defaultImage = {
    name: "aquasec/trivy:0.38.3",
    entrypoint: [""],
  };
  const defaultScript = [
    `trivy fs --quiet --format cyclonedx --output "${SBOM_FILE}" ${
      context.packageManagerInfo.componentIsInWorkspace
        ? "."
        : context.build.dir
    }`,
  ];

  const image =
    isStandaloneBuildConfig(buildConfig) &&
    buildConfig.type === "custom" &&
    buildConfig.sbom !== false
      ? (buildConfig.sbom?.jobImage ?? defaultImage)
      : defaultImage;

  const script =
    isStandaloneBuildConfig(buildConfig) &&
    buildConfig.type === "custom" &&
    buildConfig.sbom !== false
      ? (ensureArrayOrNull(buildConfig.sbom?.command) ?? defaultScript)
      : defaultScript;

  return {
    name: SBOM_BUILD_JOB_NAME,
    stage: "build",
    envMode: "jobPerEnv",
    variables: {},
    cache: undefined,
    image,
    script,
    allow_failure: true,
    artifacts: {
      paths: [SBOM_FILE],
    },
  };
};
