import type { ComponentContext, Config } from "@catladder/pipeline";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = { config: {} as Config };
const sync = vi.fn(async () => {});
vi.mock("../../../../../../config/getProjectConfig", () => ({
  getProjectConfig: async () => state.config,
}));
vi.mock("../../../../../../gcloud/localAccess", () => ({
  syncLocalAccessServiceAccount: (...args: unknown[]) => (sync as any)(...args),
}));

import { setupLocalAccess } from "../setupLocalAccess";

const cloudRun = { type: "google-cloudrun", projectId: "p", region: "r" };
const context = {
  env: "dev",
  name: "web",
  fullConfig: { customerName: "acme", appName: "shop" },
  deploy: { config: cloudRun },
} as unknown as ComponentContext;

const config = (vault: unknown) =>
  ({
    appName: "shop",
    customerName: "acme",
    components: { web: { dir: ".", build: false, deploy: cloudRun } },
    localAccess: { gcp: { presets: ["logs"] } },
    secrets: { vault },
  }) as unknown as Config;

const io = { log: () => {} } as any;

beforeEach(() => sync.mockClear());

describe("setupLocalAccess vault compatibility", () => {
  it("refuses the gitlab vault", async () => {
    state.config = config("gitlab");
    await expect(setupLocalAccess(io, context)).rejects.toThrow(
      /CI variable store/,
    );
    expect(sync).not.toHaveBeenCalled();
  });

  it("refuses the google-secret-manager vault", async () => {
    state.config = config({ type: "google-secret-manager" });
    await expect(setupLocalAccess(io, context)).rejects.toThrow(
      /google-secret-manager/,
    );
    expect(sync).not.toHaveBeenCalled();
  });

  it("syncs with the bitwarden vault", async () => {
    state.config = config({ type: "bitwarden" });
    await setupLocalAccess(io, context);
    expect(sync).toHaveBeenCalledTimes(1);
  });
});
