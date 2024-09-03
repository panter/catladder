import { gitConfigGet } from "./gitConfig";
import { exec } from "child-process-promise";

/**
 * Find the absolute path of the current git project root.
 */
export const getProjectRootPath = async (): Promise<string> => {
  const { stdout } = await exec(`git rev-parse --show-toplevel`);
  return stdout.trim();
};

/**
 * Get the git remote hostname and project path from the git config.
 */
export const getGitRemoteHostAndPath = async (): Promise<{
  gitRemoteHost: string;
  gitRemotePath: string;
}> => {
  const remoteUrl = await gitConfigGet("remote.origin.url");
  const remoteReg = /(https:\/\/|git@)([^:/]+)[:/]([^.]*)(\.git)?/;
  const match = remoteUrl.match(remoteReg) ?? [];
  const [, , gitRemoteHost, gitRemotePath] = match;
  if (!gitRemoteHost?.length || !gitRemotePath?.length) {
    throw new Error(
      `Failed to parse git remote hostname and path from git configs remote.origin.url! ${remoteUrl}`,
    );
  }
  return { gitRemoteHost, gitRemotePath };
};

export const gitProjectInformation = async () => {
  const [{ gitRemoteHost, gitRemotePath }, projectRootPath] = await Promise.all(
    [getGitRemoteHostAndPath(), getProjectRootPath()],
  );
  return {
    gitRemoteHost,
    gitRemotePath,
    projectRootPath,
  };
};
