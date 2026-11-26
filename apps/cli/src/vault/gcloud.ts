import { spawn } from "child_process";

const AUTH_PATTERNS = [
  /gcloud auth login/i,
  /reauthentication/i,
  /does not have credentials/i,
  /you do not currently have an active account/i,
  /PERMISSION_DENIED/,
  /UNAUTHENTICATED/,
];

export class GcloudAuthError extends Error {
  constructor(command: string) {
    super(
      `gcloud ${command} failed: not authenticated or not permitted — run \`gcloud auth login\` and \`gcloud auth application-default login\`, and make sure your account has access to Secret Manager in the project`,
    );
  }
}

/**
 * runs gcloud without a shell, never prompting.
 *
 * `input` goes to stdin (use it with `--data-file=-`): secret values
 * must not show up in `ps`. Errors only contain gcloud's stderr, never
 * the input or the arguments' values beyond the subcommand.
 */
export const runGcloud = (args: string[], input?: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const command = args.slice(0, 3).join(" ");
    const child = spawn("gcloud", [...args, "--quiet"], {
      env: { ...process.env, CLOUDSDK_CORE_DISABLE_PROMPTS: "1" },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString("utf-8")));
    child.stderr.on("data", (d) => (stderr += d.toString("utf-8")));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) return resolve(stdout);
      if (AUTH_PATTERNS.some((re) => re.test(stderr))) {
        return reject(new GcloudAuthError(command));
      }
      reject(new Error(`gcloud ${command} failed: ${stderr.trim()}`));
    });
    child.stdin.on("error", () => {
      // gcloud exiting early closes the pipe, the close handler reports why
    });
    child.stdin.end(input ?? "");
  });

export const runGcloudJson = async <T>(args: string[]): Promise<T> =>
  JSON.parse(await runGcloud([...args, "--format=json"]));
