import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "fs/promises";
import { existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getIsolatedGcloudEnv, readLogEntries } from "../readLogs";

let dir: string;
let home: string;
let oldEnv: NodeJS.ProcessEnv;

beforeEach(async () => {
  oldEnv = { ...process.env };
  dir = await mkdtemp(join(tmpdir(), "readlogs-test-"));
  home = join(dir, "home");
  await mkdir(join(home, ".config", "gcloud"), { recursive: true });
  await writeFile(join(home, ".config", "gcloud", "marker"), "mine");
  const bin = join(dir, "bin");
  await mkdir(bin);
  // fake gcloud: records calls and the config dir, writes into it like the real one
  await writeFile(
    join(bin, "gcloud"),
    `#!/bin/sh
echo "$CLOUDSDK_CONFIG|$GOOGLE_APPLICATION_CREDENTIALS|$CLOUDSDK_CORE_PROJECT|$*" >> "${dir}/calls"
echo "$CLOUDSDK_CONFIG" > "${dir}/configdir"
if [ "$1" = "$FAKE_GCLOUD_FAIL" ]; then echo "fake gcloud failure" >&2; exit 1; fi
if [ "$1" = "auth" ]; then echo token > "$CLOUDSDK_CONFIG/credentials.db"; exit 0; fi
echo '[{"timestamp":"2","textPayload":"newer"},{"timestamp":"1","textPayload":"older"}]'
`,
  );
  await chmod(join(bin, "gcloud"), 0o755);
  process.env.PATH = `${bin}:${process.env.PATH}`;
  process.env.HOME = home;
  process.env.GOOGLE_APPLICATION_CREDENTIALS = "/users/own/adc.json";
});
afterEach(async () => {
  process.env = oldEnv;
  await rm(dir, { recursive: true, force: true });
});

describe("readLogEntries", () => {
  it.each(["auth", "logging"])(
    "cleans up when %s fails and leaves personal credentials untouched",
    async (command) => {
      process.env.FAKE_GCLOUD_FAIL = command;
      await expect(
        readLogEntries("/k/key.json", "proj", { filter: "f", limit: 5 }),
      ).rejects.toThrow("fake gcloud failure");
      const configDir = (await readFile(join(dir, "configdir"), "utf8")).trim();
      expect(existsSync(configDir)).toBe(false);
      expect(await readdir(join(home, ".config", "gcloud"))).toEqual([
        "marker",
      ]);
      expect(
        await readFile(join(home, ".config", "gcloud", "marker"), "utf8"),
      ).toBe("mine");
    },
  );
  it("uses a throwaway config, leaves the user's gcloud alone and returns oldest first", async () => {
    const entries = await readLogEntries("/k/key.json", "proj", {
      filter: "f",
      limit: 5,
      freshness: "PT1H",
    });
    expect(entries.map((e) => e.textPayload)).toEqual(["older", "newer"]);

    const calls = (await readFile(join(dir, "calls"), "utf8"))
      .trim()
      .split("\n");
    expect(calls[0]).toContain(
      "auth activate-service-account --key-file=/k/key.json",
    );
    expect(calls[1]).toContain(
      "logging read f --format=json --limit=5 --order=desc --freshness=PT1H",
    );
    const configDir = (await readFile(join(dir, "configdir"), "utf8")).trim();
    expect(configDir.startsWith(home)).toBe(false);
    // ADC of the user is not passed on, the project is pinned
    expect(calls[1].split("|")[1]).toBe("");
    expect(calls[1].split("|")[2]).toBe("proj");
    // removed afterwards
    expect(existsSync(configDir)).toBe(false);
    // the fake HOME's gcloud folder is untouched
    expect(await readdir(join(home, ".config", "gcloud"))).toEqual(["marker"]);
    expect(
      await readFile(join(home, ".config", "gcloud", "marker"), "utf8"),
    ).toBe("mine");
  });
});

describe("getIsolatedGcloudEnv", () => {
  it("drops inherited gcloud settings", () => {
    const env = getIsolatedGcloudEnv("/c", "p", {
      PATH: "/bin",
      CLOUDSDK_CORE_ACCOUNT: "me",
      GOOGLE_APPLICATION_CREDENTIALS: "/x",
      GOOGLE_CLOUD_PROJECT: "personal",
      GCLOUD_PROJECT: "personal",
      CLOUDSDK_AUTH_CREDENTIAL_FILE_OVERRIDE: "/override",
    });
    expect(env).toMatchObject({ PATH: "/bin", CLOUDSDK_CONFIG: "/c" });
    expect(env.CLOUDSDK_CORE_ACCOUNT).toBeUndefined();
    expect(env.GOOGLE_APPLICATION_CREDENTIALS).toBeUndefined();
    expect(env.GOOGLE_CLOUD_PROJECT).toBeUndefined();
    expect(env.GCLOUD_PROJECT).toBeUndefined();
    expect(env.CLOUDSDK_AUTH_CREDENTIAL_FILE_OVERRIDE).toBeUndefined();
  });
});
