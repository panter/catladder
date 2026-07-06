import { execFile as execFileCb, spawn } from "child_process";
import { promisify } from "util";
import type { IO } from "../core/types";
import {
  getPreference,
  hasPreference,
  setPreference,
} from "../utils/preferences";

const execFile = promisify(execFileCb);

const SESSION_PREFERENCE = "bwsession";

class BitwardenLockedError extends Error {
  constructor() {
    super(
      "bitwarden is locked and prompting is disabled — run `bw unlock` or catenv without --vault-mode no-prompt",
    );
  }
}

/**
 * runs an interactive bw command that prints a session key on stdout
 * (login/unlock) while the user types the password on the terminal
 */
const interactiveSessionCommand = (args: string[]): Promise<string> =>
  new Promise((resolve, reject) => {
    const child = spawn("bw", [...args, "--raw"], {
      stdio: ["inherit", "pipe", "inherit"],
    });
    let session = "";
    child.stdout?.on("data", (data) => (session += data.toString("utf-8")));
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 && session.trim()
        ? resolve(session.trim())
        : reject(new Error(`bw ${args[0]} failed`)),
    );
  });

const getBwStatus = async (
  session: string | null,
): Promise<"unlocked" | "locked" | "unauthenticated"> => {
  try {
    const { stdout } = await execFile("bw", ["status"], {
      env: { ...process.env, ...(session ? { BW_SESSION: session } : {}) },
    });
    return JSON.parse(stdout).status;
  } catch {
    return "unauthenticated";
  }
};

/**
 * a working bw session: reuses the cached one, otherwise unlocks (or
 * logs in) interactively — unless prompting is disabled
 */
export const getBwSession = async (
  io: IO | null,
  { allowPrompt }: { allowPrompt: boolean },
): Promise<string> => {
  const cached = (await hasPreference(SESSION_PREFERENCE))
    ? String(await getPreference(SESSION_PREFERENCE))
    : null;

  const status = await getBwStatus(cached);
  if (status === "unlocked" && cached) {
    return cached;
  }
  if (!allowPrompt) {
    throw new BitwardenLockedError();
  }

  io?.log("");
  io?.log(
    status === "unauthenticated"
      ? "# Please login to Bitwarden:"
      : "# Bitwarden is locked, please unlock:",
  );
  io?.log("");
  const session = await interactiveSessionCommand([
    status === "unauthenticated" ? "login" : "unlock",
  ]);
  await setPreference(SESSION_PREFERENCE, session);
  await runBw(session, ["sync"]);
  return session;
};

/**
 * runs a bw command with the given session and returns stdout
 */
export const runBw = async (
  session: string,
  args: string[],
): Promise<string> => {
  const { stdout } = await execFile(
    "bw",
    [...args, "--raw", "--nointeraction"],
    {
      env: { ...process.env, BW_SESSION: session },
      maxBuffer: 50 * 1024 * 1024,
    },
  );
  return stdout;
};

export const runBwJson = async <T>(
  session: string,
  args: string[],
): Promise<T> => JSON.parse(await runBw(session, args));
