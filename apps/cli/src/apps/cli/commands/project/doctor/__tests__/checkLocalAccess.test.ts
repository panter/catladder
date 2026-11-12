import type { ComponentContext, Config } from "@catladder/pipeline";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = { exists: true, keys: ["k1"] as string[] };
vi.mock("../../../../../../gcloud/serviceAccounts", () => ({
  accountExists: async () => state.exists,
}));
vi.mock("../../../../../../gcloud/localAccess", async (orig) => ({
  ...(await orig<object>()),
  listUserManagedKeyIds: async () => state.keys,
}));

import { checkLocalAccess } from "../checkLocalAccess";

const cloudRun = { type: "google-cloudrun", projectId: "p", region: "r" };

const context = {
  env: "dev",
  name: "web",
  fullConfig: { customerName: "acme", appName: "shop" },
  deploy: { config: cloudRun },
} as unknown as ComponentContext;

const config = (extra: Partial<Config> = {}) =>
  ({
    appName: "shop",
    customerName: "acme",
    components: { web: { dir: ".", build: false, deploy: cloudRun } },
    localAccess: { gcp: { presets: ["logs"] } },
    secrets: { vault: { type: "bitwarden" } },
    ...extra,
  }) as Config;

const run = async (
  cfg: Config,
  bound: string[] = ["roles/logging.viewer"],
  conditional: string[] = [],
) => {
  const out: string[] = [];
  const report = {
    section: (t: string) => out.push(`section:${t}`),
    ok: (m: string) => out.push(`ok:${m}`),
    warn: (m: string) => out.push(`warn:${m}`),
    fail: (m: string) => out.push(`fail:${m}`),
  } as any;
  const inspector = {
    getUnconditionalRolesOfMember: async () => bound,
    getConditionalRolesOfMember: async () => conditional,
  } as any;
  await checkLocalAccess(report, cfg, [context], inspector);
  return out;
};

beforeEach(() => {
  state.exists = true;
  state.keys = ["k1"];
});

describe("checkLocalAccess", () => {
  it("is silent without a declaration and without an account", async () => {
    state.exists = false;
    expect(await run(config({ localAccess: undefined }))).toEqual([]);
  });

  it("is ok when roles and key match", async () => {
    const out = await run(config());
    expect(out.some((l) => l.startsWith("ok:"))).toBe(true);
    expect(out.some((l) => /^(fail|warn):/.test(l))).toBe(false);
  });

  it("reports missing and extra roles", async () => {
    const out = await run(config(), ["roles/run.admin"]);
    expect(out.join("\n")).toMatch(
      /fail:.*missing roles: roles\/logging.viewer/,
    );
    expect(out.join("\n")).toMatch(/fail:.*undeclared roles: roles\/run.admin/);
  });

  it("reports conditional roles", async () => {
    const out = await run(config(), ["roles/logging.viewer"], ["roles/x.y"]);
    expect(out.join("\n")).toMatch(/fail:.*conditional roles/);
  });

  it("reports a missing account", async () => {
    state.exists = false;
    expect((await run(config())).join("\n")).toMatch(/fail:.*does not exist/);
  });

  it("warns about an account that is not declared any more", async () => {
    expect((await run(config({ localAccess: undefined }))).join("\n")).toMatch(
      /warn:.*exists although no local access is declared/,
    );
  });

  it.each([[[]], [["k1", "k2"]]])("reports %j keys", async (keys) => {
    state.keys = keys;
    expect((await run(config())).join("\n")).toMatch(
      new RegExp(`fail:.*${keys.length} user-managed keys`),
    );
  });

  it("refuses the gitlab vault", async () => {
    const out = await run(config({ secrets: { vault: "gitlab" } } as any));
    expect(out.join("\n")).toMatch(/fail:.*not a CI variable store/);
  });

  it("reports an invalid declaration instead of throwing", async () => {
    const out = await run(
      config({ localAccess: { gcp: { roles: ["roles/owner"] } } }),
    );
    expect(out.join("\n")).toMatch(/fail:.*not allowed/);
  });

  it("reports a credentialsEnvVar exported by several envs", async () => {
    const out = await run(
      config({
        localAccess: {
          gcp: {
            presets: ["logs"],
            credentialsEnvVar: "GOOGLE_APPLICATION_CREDENTIALS",
          },
        },
      }),
    );
    expect(out.join("\n")).toMatch(/fail:.*declared by both/);
  });
});
