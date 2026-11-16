import { execFile } from "child_process";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

/** env vars that would let gcloud pick up credentials or config of the user */
const DROPPED_ENV_PREFIXES = [
  "CLOUDSDK_",
  "GOOGLE_APPLICATION_CREDENTIALS",
  "GOOGLE_CLOUD_",
  "GCLOUD_",
];

export const getIsolatedGcloudEnv = (
  configDir: string,
  projectId: string,
  base: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv => ({
  ...Object.fromEntries(
    Object.entries(base).filter(
      ([name]) => !DROPPED_ENV_PREFIXES.some((p) => name.startsWith(p)),
    ),
  ),
  CLOUDSDK_CONFIG: configDir,
  CLOUDSDK_CORE_PROJECT: projectId,
  CLOUDSDK_CORE_DISABLE_PROMPTS: "1",
  CLOUDSDK_CORE_DISABLE_USAGE_REPORTING: "true",
});

const MAX_BUFFER = 256 * 1024 * 1024;

/**
 * runs gcloud as the given service account with a throwaway config
 * directory (CLOUDSDK_CONFIG): the user's `~/.config/gcloud`, their
 * login and application default credentials are neither read nor
 * written. The directory is removed afterwards, also on failure.
 */
export const withIsolatedGcloud = async <T>(
  keyFile: string,
  projectId: string,
  fn: (run: (args: string[]) => Promise<string>) => Promise<T>,
): Promise<T> => {
  const configDir = await mkdtemp(join(tmpdir(), "catladder-gcloud-"));
  const env = getIsolatedGcloudEnv(configDir, projectId);
  const run = async (args: string[]) =>
    (await execFileAsync("gcloud", args, { env, maxBuffer: MAX_BUFFER }))
      .stdout;
  try {
    await run([
      "auth",
      "activate-service-account",
      `--key-file=${keyFile}`,
      "--quiet",
    ]);
    return await fn(run);
  } finally {
    await rm(configDir, { recursive: true, force: true });
  }
};

export type ReadLogsOptions = {
  filter: string;
  limit: number;
  /** iso 8601 duration, see parseSince */
  freshness?: string;
};

/** the entries matching the filter, oldest first */
export const readLogEntries = async (
  keyFile: string,
  projectId: string,
  { filter, limit, freshness }: ReadLogsOptions,
): Promise<Record<string, unknown>[]> =>
  withIsolatedGcloud(keyFile, projectId, async (run) => {
    const out = await run([
      "logging",
      "read",
      filter,
      "--format=json",
      `--limit=${limit}`,
      "--order=desc",
      ...(freshness ? [`--freshness=${freshness}`] : []),
    ]);
    return (JSON.parse(out || "[]") as Record<string, unknown>[]).reverse();
  });
