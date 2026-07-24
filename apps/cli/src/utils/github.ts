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

/**
 * runs a paginated `gh api` query and returns the jq-extracted lines
 * (one value per line, e.g. names)
 */
const ghApiLines = async (path: string, jq: string): Promise<string[]> => {
  const { stdout } = await execFile(
    "gh",
    ["api", "--paginate", path, "--jq", jq],
    { maxBuffer: 10 * 1024 * 1024 },
  );
  return stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
};

/** names of all deployment environments of the repository */
export const listGithubEnvironments = (repo: string): Promise<string[]> =>
  ghApiLines(`repos/${repo}/environments?per_page=100`, ".environments[].name");

/**
 * names of the actions secrets — of an environment, or of the repo
 * level when no environment is given. Github secrets are write-only:
 * names are all that can ever be inspected.
 */
export const listGithubSecretNames = (
  repo: string,
  environment?: string,
): Promise<string[]> =>
  ghApiLines(
    environment
      ? `repos/${repo}/environments/${encodeURIComponent(environment)}/secrets?per_page=100`
      : `repos/${repo}/actions/secrets?per_page=100`,
    ".secrets[].name",
  );

/** names of the actions variables (environment or repo level) */
export const listGithubVariableNames = (
  repo: string,
  environment?: string,
): Promise<string[]> =>
  ghApiLines(
    environment
      ? `repos/${repo}/environments/${encodeURIComponent(environment)}/variables?per_page=100`
      : `repos/${repo}/actions/variables?per_page=100`,
    ".variables[].name",
  );

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
