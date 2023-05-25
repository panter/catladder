import { DEPLOY_JOB_NAME } from "../deploy/base";
import type { Context } from "../types/context";
import type { CatladderJob } from "../types/jobs";
import { ensureArray } from "../utils";

const STAGE = "verify";
const SBOM_GENERATE_JOB_NAME = "🧾 sbom";
const SBOM_FILE = "__sbom.json";

const createSbomGenerateJob = (context: Context): CatladderJob => {
  const buildConfig = context.componentConfig.build;

  const defaultImage = "aquasec/trivy:0.38.3";
  const defaultScript = [
    `trivy fs --quiet --format cyclonedx --output "${SBOM_FILE}" ${
      context.packageManagerInfo?.componentIsInWorkspace
        ? "."
        : context.componentConfig.dir
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
    name: SBOM_GENERATE_JOB_NAME,
    stage: STAGE,
    needs: context.componentConfig.deploy !== false ? [DEPLOY_JOB_NAME] : [],
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

const createSbomUploadJob = (context: Context): CatladderJob => {
  return {
    name: "🧾 sbom upload",
    stage: STAGE,
    needs: [SBOM_GENERATE_JOB_NAME],
    envMode: "jobPerEnv",
    variables: {},
    cache: undefined,
    image:
      "git.panter.ch:5001/open-source/dependency-track-uploader:dtrackuploader-v0.2.1",
    script: [
      `/dtrackuploader https://dep.panter.swiss/ "$DT_KEY" upload "${context.fullConfig.customerName}-${context.fullConfig.appName}/${context.componentName}" "${context.environment.shortName}" "${SBOM_FILE}" vex.json`,
    ],
    allow_failure: true,
  };
};

export const createReportingJobs = (context: Context) =>
  context.componentConfig.build.type === "custom" &&
  context.componentConfig.build.sbom === false
    ? []
    : [createSbomGenerateJob(context), createSbomUploadJob(context)];
