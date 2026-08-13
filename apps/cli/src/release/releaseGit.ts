/**
 * git helpers shared by the release-related catci jobs (changesets
 * release, changeset check).
 */
import { execFile as execFileCb } from "child_process";
import { promisify } from "util";

const execFile = promisify(execFileCb);

export const git = async (...args: string[]): Promise<string> => {
  const { stdout } = await execFile("git", args);
  return stdout.trim();
};

/** like `git`, but with extra environment variables (e.g. GIT_SSH_COMMAND) */
export const gitWithEnv = async (
  env: Record<string, string>,
  ...args: string[]
): Promise<string> => {
  const { stdout } = await execFile("git", args, {
    env: { ...process.env, ...env },
  });
  return stdout.trim();
};

/**
 * CI checkouts are usually shallow and tagless (gitlab clones with
 * depth 1; github's checkout needs fetch-depth: 0) — the local history
 * then cannot answer "nearest v* tag" and the job would rederive the
 * FIRST release version. Deepen and fetch tags before deriving.
 */
export const ensureReleaseHistory = async () => {
  const shallow = await git("rev-parse", "--is-shallow-repository").catch(
    () => "false",
  );
  try {
    if (shallow === "true") {
      await git("fetch", "--quiet", "--unshallow", "--tags", "origin");
    } else {
      await git("fetch", "--quiet", "--tags", "origin");
    }
  } catch (e) {
    console.warn(
      `could not fetch tags from origin (${e}) — version derivation may be wrong on a shallow clone`,
    );
  }
};

export const getLastReleaseTag = async (): Promise<string | null> => {
  try {
    // the nearest v* tag in the history of HEAD — on hotfix branches
    // this is deliberately the branch's own release line, not the
    // globally highest version
    return await git("describe", "--tags", "--abbrev=0", "--match", "v[0-9]*");
  } catch {
    return null;
  }
};
