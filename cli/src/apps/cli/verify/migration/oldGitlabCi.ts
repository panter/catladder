import type { BuildConfig } from "@catladder/pipeline";

export type OldGitlabCiFile = {
  variables: {
    CUSTOMER_NAME: string;
    APP_NAME: string;
    COMPONENT_NAME?: string;
    APP_DIR?: string;
    CLUSTER_NAME?: string;
    STAGING_ENABLED?: string;
  };
  include: {
    project: string;
    ref: string;
    file: string;
  }[];
};

export const isOldInclude = (gitlabCi: OldGitlabCiFile) => {
  return gitlabCi.include[0]?.project === "catladder/gitlab-ci";
};

export const detectBuildConfig = (
  gitlabCi: OldGitlabCiFile
): BuildConfig["type"] | "monorepo" => {
  if (!isOldInclude(gitlabCi)) {
    throw new Error("unsupported gitlab-ci file");
  }

  const firstInclude = gitlabCi.include[0];

  if (firstInclude.file === "monorepo.yml") return "monorepo";

  if (firstInclude.file === "node-kubernetes.yml") {
    return "node";
  }

  if (firstInclude.file === "static-js-kubernetes.yml") {
    return "node-static";
  }
  if (firstInclude.file === "meteor-kubernetes.yml") {
    return "meteor";
  }

  if (firstInclude.file === "rails-kubernetes.yml") {
    return "rails";
  }
};
