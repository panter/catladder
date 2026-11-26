import type { Config } from "@catladder/pipeline";
import { describe, expect, it } from "vitest";
import { checkSecretManager } from "../checkSecretManager";

const config = (vault: unknown) =>
  ({
    appName: "shop",
    customerName: "acme",
    components: {},
    secrets: { vault },
  }) as unknown as Config;

const gsm = config({ type: "google-secret-manager", project: "p" });

const run = async (
  cfg: Config,
  gcloud: (args: string[]) => Promise<string>,
) => {
  const out: string[] = [];
  const report = {
    section: (t: string) => out.push(`section:${t}`),
    ok: (m: string) => out.push(`ok:${m}`),
    warn: (m: string) => out.push(`warn:${m}`),
    fail: (m: string) => out.push(`fail:${m}`),
  } as any;
  await checkSecretManager(report, cfg, gcloud);
  return out;
};

describe("checkSecretManager", () => {
  it("is silent for other vaults", async () => {
    expect(await run(config({ type: "bitwarden" }), async () => "")).toEqual(
      [],
    );
  });

  it("reports ok when the API is enabled and access works", async () => {
    const out = await run(gsm, async (args) =>
      args[0] === "services" ? "secretmanager.googleapis.com\n" : "",
    );
    expect(out.filter((l) => l.startsWith("ok:"))).toHaveLength(2);
    expect(out.some((l) => l.startsWith("fail:"))).toBe(false);
  });

  it("fails when the API is not enabled", async () => {
    const out = await run(gsm, async () => "");
    expect(out.some((l) => /fail:.*not enabled/.test(l))).toBe(true);
  });

  it("fails when access is denied", async () => {
    const out = await run(gsm, async (args) => {
      if (args[0] === "services") return "secretmanager.googleapis.com";
      throw new Error("denied");
    });
    expect(out.some((l) => /fail:.*denied/.test(l))).toBe(true);
  });
});
