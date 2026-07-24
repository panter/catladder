import type { DeployConfigNpmPackage, DeployTypeDefinition } from "..";
import { createNpmPackageDeployJobs } from "./deployJob";

export const NPM_TOKEN_SECRET_KEY = "NPM_TOKEN";

export const NPM_PACKAGE_DEPLOY_TYPE: DeployTypeDefinition<DeployConfigNpmPackage> =
  {
    jobs: createNpmPackageDeployJobs,
    defaults: () => ({}),
    additionalSecretKeys: (ctx) =>
      // publish credentials don't exist for the local env
      ctx.envType !== "local"
        ? [{ key: NPM_TOKEN_SECRET_KEY, hidden: true }]
        : [],
    getAdditionalEnvVars: () => ({}),
  };
