import { BuildConfig } from "@catladder/pipeline";

export type OldGitlabCiFile = {
  variables: {
    CUSTOMER_NAME: string;
    APP_NAME: string;
    COMPONENT_NAME?: string;
    APP_DIR?: string;
    CLUSTER_NAME?: string;
  };
  include: {
    project: string;
    ref: string;
    file: string;
  }[];
};

export const detectBuildConfig = (
  gitlabCi: OldGitlabCiFile
): BuildConfig["type"] => {
  const firstInclude = gitlabCi.include[0];
  if (!firstInclude || gitlabCi.include[0]?.project !== "catladder/gitlab-ci") {
    throw new Error("unsupported gitlab-ci file");
  }

  if (firstInclude.file === "node-kubernetes.yml") {
    return "node";
  }

  if (firstInclude.file === "static-js-kubernetes.yml") {
    return "node-static";
  }
  if (firstInclude.file === "meteor-kubernetes.yml") {
    throw new Error("meteor is not yet implemented");
  }

  if (firstInclude.file === "rails-kubernetes.yml") {
    throw new Error("meteor is not yet implemented");
  }
};
