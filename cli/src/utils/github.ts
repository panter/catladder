import { execFile as execFileCb, spawn } from "child_process";
import { promisify } from "util";

const execFile = promisify(execFileCb);

/**
 * whether the github cli (gh) is installed and authenticated
 */
export const isGhAuthenticated = async (): Promise<boolean> => {
  try {
    await execFile("gh", ["auth", "status"]);
    return true;
  } catch {
    return false;
  }
};

/**
 * the github repository (owner/name) a git remote points to.
 * Which remote belongs to github is configured per pipeline type
 * (`pipelines.github.gitRemote`, defaults to origin).
 */
export const getGithubRepoFromRemote = async (
  remoteName: string,
): Promise<string | undefined> => {
  try {
    const { stdout } = await execFile("git", ["remote", "get-url", remoteName]);
    const match = stdout.match(
      /github\.com[:/]([\w.-]+\/[\w.-]+?)(\.git)?\s*$/,
    );
    return match?.[1];
  } catch {
    return undefined;
  }
};

const ghSetViaStdin = (
  kind: "secret" | "variable",
  repo: string,
  name: string,
  value: string,
  environment?: string,
): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    const child = spawn(
      "gh",
      [
        kind,
        "set",
        name,
        "--repo",
        repo,
        ...(environment ? ["--env", environment] : []),
      ],
      { stdio: ["pipe", "ignore", "pipe"] },
    );
    let stderr = "";
    child.stderr?.on("data", (data) => (stderr += data));
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`gh ${kind} set ${name} failed: ${stderr.trim()}`)),
    );
    child.stdin?.end(value);
  });

/**
 * sets a github actions repository secret via the gh cli.
 * The value is passed via stdin so it never shows up in a process list.
 */
export const setGithubSecret = async (
  repo: string,
  name: string,
  value: string,
  environment?: string,
): Promise<void> => ghSetViaStdin("secret", repo, name, value, environment);

/**
 * sets a github actions repository variable (plain, unmasked) via the
 * gh cli — for vault values classified as not sensitive
 */
export const setGithubVariable = async (
  repo: string,
  name: string,
  value: string,
  environment?: string,
): Promise<void> => ghSetViaStdin("variable", repo, name, value, environment);

/**
 * creates the github environment when it does not exist (idempotent —
 * PUT with an empty body leaves existing settings untouched)
 */
export const ensureGithubEnvironment = async (
  repo: string,
  environment: string,
): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    const child = spawn(
      "gh",
      [
        "api",
        "-X",
        "PUT",
        `repos/${repo}/environments/${encodeURIComponent(environment)}`,
      ],
      { stdio: ["ignore", "ignore", "pipe"] },
    );
    let stderr = "";
    child.stderr?.on("data", (data) => (stderr += data));
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0
        ? resolve()
        : reject(
            new Error(
              `creating github environment ${environment} failed: ${stderr.trim()}`,
            ),
          ),
    );
  });
