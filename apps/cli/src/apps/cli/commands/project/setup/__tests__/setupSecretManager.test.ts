import type { Config } from "@catladder/pipeline";
import { beforeEach, describe, expect, it, vi } from "vitest";

const enable = vi.fn(async () => undefined);
vi.mock("../../../../../../gcloud/enableServices", () => ({
  enableGCloudServices: (...args: unknown[]) => enable(...(args as [])),
}));

import { setupSecretManager } from "../setupSecretManager";

const config = (vault: unknown) =>
  ({
    appName: "shop",
    customerName: "acme",
    components: {},
    secrets: { vault },
  }) as unknown as Config;

const io = { log: vi.fn() } as any;

beforeEach(() => enable.mockClear());

describe("setupSecretManager", () => {
  it("enables the Secret Manager API in the vault project", async () => {
    await setupSecretManager(
      io,
      config({ type: "google-secret-manager", project: "my-proj" }),
    );
    expect(enable).toHaveBeenCalledWith(["secretmanager.googleapis.com"], {
      projectId: "my-proj",
    });
  });

  it("does nothing for other vaults", async () => {
    await setupSecretManager(io, config({ type: "bitwarden" }));
    await setupSecretManager(io, config("gitlab"));
    expect(enable).not.toHaveBeenCalled();
  });
});
