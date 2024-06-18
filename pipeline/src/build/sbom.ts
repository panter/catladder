import type { ComponentContext } from "../types/context";
import type { CatladderJob } from "../types/jobs";
import { ensureArray } from "../utils";

export const SBOM_BUILD_JOB_NAME = "🧾 sbom";
export const SBOM_FILE = "__sbom.json";

export const createSbomBuildJob = (context: ComponentContext): CatladderJob => {
  const buildConfig = context.build.config;

  const defaultImage = "aquasec/trivy:0.38.3";
  const defaultScript = [
    `trivy fs --quiet --format cyclonedx --output "${SBOM_FILE}" ${
      context.build.packageManagerInfo.componentIsInWorkspace
        ? "."
        : context.build.dir
    }`,
  ];

  const image =
    buildConfig.type === "custom" && buildConfig.sbom !== false
      ? buildConfig.sbom?.jobImage ?? defaultImage
      : defaultImage;

  const script =
    buildConfig.type === "custom" && buildConfig.sbom !== false
      ? ensureArray(buildConfig.sbom?.command) ?? defaultScript
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
