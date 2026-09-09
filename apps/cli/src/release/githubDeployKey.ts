/**
 * the github release deploy key — how a release push gets past the
 * merge-gating ruleset.
 *
 * The ruleset `project setup` creates requires the `catladder ✅` check
 * on the default branch, which a fresh release commit can never carry.
 * Only a deploy key can bypass the ruleset (github deliberately never
 * lets the workflow token bypass one), so setup provisions a write
 * deploy key and stores its private half as the CATLADDER_RELEASE_KEY
 * actions secret, which the generated release jobs pass into the job
 * env. Both release methods push with it:
 *
 * - changesets: catci makes the push itself (pushWithDeployKey)
 * - semantic-release: `@semantic-release/git` and semantic-release
 *   itself push, to the repository url they are given. catci prepares
 *   the ssh setup (configureDeployKeyRemote) and the runner script
 *   passes the ssh url as `--repository-url`. That flag is needed —
 *   semantic-release derives the url from package.json's `repository`
 *   field before it looks at `origin`, and actions/checkout leaves an
 *   https origin authenticated with the workflow token behind, which
 *   the ruleset rejects (GH013).
 *
 * Without the secret both methods push with the workflow token, which
 * works on repositories without merge gating.
 */
import { mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { git, gitWithEnv } from "./releaseGit";

export const RELEASE_DEPLOY_KEY_ENV = "CATLADDER_RELEASE_KEY";

/** title of the deploy key `project setup` registers (see githubMergeGating) */
const RELEASE_DEPLOY_KEY_TITLE = "catladder release";

const requireEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set — cannot push the release`);
  }
  return value;
};

/** the private key from the job env, or null when not provisioned */
export const getReleaseDeployKey = (): string | null =>
  process.env[RELEASE_DEPLOY_KEY_ENV] || null;

/** the ssh url of the repository, from the github-provided env */
export const deployKeyRemoteUrl = (): string => {
  const serverUrl = process.env.GITHUB_SERVER_URL ?? "https://github.com";
  const host = new URL(serverUrl).host;
  const repository = requireEnv("GITHUB_REPOSITORY");
  return `git@${host}:${repository}.git`;
};

/** the ssh command using exactly the deploy key (GIT_SSH_COMMAND / core.sshCommand) */
export const deployKeySshCommand = (keyFile: string): string =>
  `ssh -i ${keyFile} -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new`;

/**
 * writes the private key into a fresh temp dir and returns the file
 * path. A key file without a trailing newline is rejected by openssh,
 * and the secret may come without one.
 */
export const writeDeployKeyFile = async (privateKey: string) => {
  const dir = await mkdtemp(join(tmpdir(), "release-key-"));
  const keyFile = join(dir, "id_ed25519");
  await writeFile(
    keyFile,
    privateKey.endsWith("\n") ? privateKey : `${privateKey}\n`,
    { mode: 0o600 },
  );
  return { dir, keyFile };
};

/**
 * pushes the refs over ssh with the release deploy key — the changesets
 * release path (catci pushes itself)
 */
export const pushWithDeployKey = async (privateKey: string, refs: string[]) => {
  const { dir, keyFile } = await writeDeployKeyFile(privateKey);
  try {
    await gitWithEnv(
      { GIT_SSH_COMMAND: deployKeySshCommand(keyFile) },
      "push",
      "--atomic",
      deployKeyRemoteUrl(),
      ...refs,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
};

/**
 * the semantic-release release path: prepares the checkout so that git
 * pushes to the ssh url of the repository authenticate with the release
 * deploy key, verifies the key actually reaches the repository, and
 * returns the ssh url (the runner script passes it to semantic-release
 * as `--repository-url`). Nothing is cleaned up on purpose — the key
 * file has to outlive this process, semantic-release runs afterwards
 * in the same (ephemeral) job container.
 */
export const configureDeployKeyRemote = async (
  privateKey: string,
): Promise<string> => {
  const remote = deployKeyRemoteUrl();
  const { keyFile } = await writeDeployKeyFile(privateKey);
  // the repo config, not the env: every git process semantic-release
  // and its plugins spawn picks it up
  await git("config", "core.sshCommand", deployKeySshCommand(keyFile));
  try {
    await git("ls-remote", "--exit-code", remote, "HEAD");
  } catch (e) {
    throw new Error(
      `the release deploy key cannot reach ${remote}: ${e?.message ?? e}\n` +
        `The ${RELEASE_DEPLOY_KEY_ENV} secret does not match the '${RELEASE_DEPLOY_KEY_TITLE}' deploy key of the repository ` +
        `(or the key was removed). Run \`catladder project setup\` to provision both again, then rerun this job.`,
    );
  }
  return remote;
};

/**
 * `catci release github-deploy-key-remote`: only the ssh url goes to
 * stdout (the caller captures it), everything else to stderr
 */
export const githubDeployKeyRemoteJob = async () => {
  const privateKey = getReleaseDeployKey();
  if (!privateKey) {
    throw new Error(
      `${RELEASE_DEPLOY_KEY_ENV} is not set — the release push cannot use the deploy key ` +
        `(without merge gating the workflow token push works: run semantic-release without --repository-url)`,
    );
  }
  const remote = await configureDeployKeyRemote(privateKey);
  console.error(
    `release push: ${remote} over ssh with the release deploy key (bypasses the merge-gating ruleset)`,
  );
  process.stdout.write(`${remote}\n`);
};
