import { getAllCacheConfigsFromConfig } from "../../build/cache/getAllCacheConfigsFromConfig";
import { getPackageManagerInstall } from "../../build/node/packageManagerInstall";
import { getRunnerImage } from "../../runner";
import type { ComponentContext } from "../../types/context";
import type { CatladderJob } from "../../types/jobs";
import { createDeployementJobs } from "../base";
import { isOfDeployType } from "../types";

export const createPagesDeployJobs = async (
  context: ComponentContext,
): Promise<CatladderJob[]> => {
  const deployConfig = context.deploy?.config;
  if (!isOfDeployType(deployConfig, "pages")) {
    // should not happen
    throw new Error("deploy config is not pages");
  }
  const onGithub = context.pipelineType === "github";
  if (onGithub && context.environment.envType === "review") {
    // github pages serves ONE site per repository and deploy-pages
    // replaces all of it — there is no path_prefix equivalent, so per-PR
    // previews cannot exist (deploy-pages has a `preview` input, but it
    // is alpha and not publicly available). Warn instead of throwing, so
    // the github generation of a multi-backend project still succeeds.
    console.warn(
      `component "${context.name}": github pages cannot host per-merge-request previews (one site per repository) — no review deploy job generated`,
    );
    return [];
  }

  // review environments publish under their own path prefix (gitlab
  // parallel deployments) — every merge request gets a site preview
  const pathPrefix =
    context.environment.envType === "review" ? "mr-$CI_MERGE_REQUEST_IID" : "";
  const publishDir = deployConfig.publishDir ?? "public";

  const packageManagerInstall = await getPackageManagerInstall(context, {
    noCustomPostInstall: true,
  });

  return createDeployementJobs(context, {
    deploy: {
      image: deployConfig.jobImage ?? getRunnerImage("jobs-default"),
      cache: getAllCacheConfigsFromConfig(context, deployConfig),
      artifacts: { paths: [publishDir] },
      pages: { path_prefix: pathPrefix },
      script: [
        `cd ${context.build.dir}`,
        ...((deployConfig.requiresInstall ?? deployConfig.requiresYarnInstall)
          ? packageManagerInstall
          : []),
        ...deployConfig.script,
        // the gitlab environment url should point at the published site
        // (the base deploy job reports $ROOT_URL as environment url).
        // On github the url is only known after deploy-pages ran, so the
        // backend takes it from that step's output instead.
        ...(onGithub
          ? []
          : [
              `export ROOT_URL="$CI_PAGES_URL${pathPrefix ? `/${pathPrefix}` : ""}"`,
            ]),
      ],
      variables: {},
      runnerVariables: {
        // exposed so build scripts can adjust e.g. their base url
        PAGES_PREFIX: pathPrefix,
        // a pages deploy runs a full site build — the generic deploy-job
        // resources (200Mi/400Mi) OOM on any real yarn install + build
        KUBERNETES_MEMORY_REQUEST: "1Gi",
        KUBERNETES_MEMORY_LIMIT: "4Gi",
      },
    },
  });
};
