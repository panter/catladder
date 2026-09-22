import { execFile as execFileCb } from "child_process";
import { promisify } from "util";
import type { Config } from "../../types";
import { getPipelineGitRemote, getPipelineOptions } from "../index";
import {
  GHCR_REPOSITORY_EXPRESSION,
  parseGithubRepoFromRemoteUrl,
  toGhcrRegistryImage,
} from "./ghcr";

const execFile = promisify(execFileCb);

/**
 * the ghcr image prefix derived from the config alone
 * (`pipelines.github.repository`), without touching git.
 *
 * Used where generation must stay pure and hermetic (tests, examples);
 * {@link resolveGithubRegistryImage} adds the git remote fallback.
 */
export const githubRegistryImageFromConfig = (
  config: Config,
): string | undefined => {
  const { repository } = getPipelineOptions(config, "github");
  return repository ? toGhcrRegistryImage(repository) : undefined;
};

/**
 * the ghcr image prefix to generate with: the configured repository, or
 * the one the github git remote points at.
 *
 * Falls back to the `${{ github.repository }}` expression when the
 * remote is unavailable (a checkout without the remote, a tarball, …).
 * That is the pre-existing behavior and correct for every all-lowercase
 * repository; `project doctor` catches the mixed-case case it is not
 * correct for.
 */
export const resolveGithubRegistryImage = async (
  config: Config,
): Promise<string> => {
  const fromConfig = githubRegistryImageFromConfig(config);
  if (fromConfig) {
    return fromConfig;
  }
  const remote = getPipelineGitRemote(config, "github");
  try {
    const { stdout } = await execFile("git", ["remote", "get-url", remote]);
    const repository = parseGithubRepoFromRemoteUrl(stdout);
    return repository
      ? toGhcrRegistryImage(repository)
      : GHCR_REPOSITORY_EXPRESSION;
  } catch {
    return GHCR_REPOSITORY_EXPRESSION;
  }
};
