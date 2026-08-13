import type { ComponentContext } from "../../types/context";
import type { CatladderJob } from "../../types/jobs";
import { getRunnerImage } from "../../runner";
import { GENERATED_CATCI_FOLDER } from "../../catci/shippedCatci";
import { createDeployementJobs } from "../base";
import { isOfDeployType } from "../types";

export const createNpmPackageDeployJobs = (
  context: ComponentContext,
): CatladderJob[] => {
  const deployConfig = context.deploy?.config;
  if (!isOfDeployType(deployConfig, "npmPackage")) {
    // should not happen
    throw new Error("deploy config is not npmPackage");
  }

  const args = [
    `--dir ${context.build.dir}`,
    `--env-type ${context.environment.envType}`,
    ...(deployConfig.access ? [`--access ${deployConfig.access}`] : []),
    ...(deployConfig.registry ? [`--registry ${deployConfig.registry}`] : []),
    ...(deployConfig.distTag ? [`--dist-tag ${deployConfig.distTag}`] : []),
  ];

  return createDeployementJobs(context, {
    deploy: {
      // dedicated image: publishing needs npm >= 11.5.1 for trusted
      // publishing (OIDC), which jobs-default's node does not carry
      image: getRunnerImage("npm-publish"),
      // github: lowered to `id-token: write` so npm can exchange the
      // workflow's OIDC token for short-lived publish credentials
      idToken: true,
      script: [
        // catci derives version + dist-tag from the pipeline trigger,
        // sets the version in package.json and runs npm publish
        `node ${GENERATED_CATCI_FOLDER}/index.js publish npm ${args.join(" ")}`,
      ],
      variables: {},
    },
  });
};
