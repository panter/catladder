import { join } from "path";
import { getProjectConfig, parseChoice } from "../../config/getProjectConfig";

import { readFileOrError } from "../files";
import { exec } from "child-process-promise";

export const getGitRoot = async (): Promise<string> => {
  return (await exec(`git rev-parse --show-toplevel`)).stdout.trim();
};

export const getRootGitlabCiFile = async () => {
  const gitRoot = await getGitRoot();
  return join(gitRoot, ".gitlab-ci.yml");
};

export const readRootGitlabCiFile = async () =>
  readFileOrError(await getRootGitlabCiFile());

export const hasGitlabCiFile = async () => {
  const [error, file] = await readRootGitlabCiFile();
  if (error) {
    return false;
  }
  return true;
};

export const getProjectNamespace = async (envComponent: string) => {
  const { env } = parseChoice(envComponent);
  const config = await getProjectConfig();
  return `${config.customerName}-${config.appName}-${env}`;
};
