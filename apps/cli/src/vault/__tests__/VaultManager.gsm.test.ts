import type { Config } from "@catladder/pipeline";
import { getVaultConfig } from "@catladder/pipeline";
import { describe, expect, it } from "vitest";
import { GoogleSecretManagerVault } from "../GoogleSecretManagerVault";
import { VaultManager } from "../VaultManager";

const config = {
  customerName: "pan",
  appName: "app",
  components: {},
  secrets: { vault: { type: "google-secret-manager", project: "proj" } },
} as unknown as Config;

describe("VaultManager with google-secret-manager", () => {
  it("builds a GoogleSecretManagerVault", () => {
    const manager = new VaultManager(config);
    expect(manager.vault).toBeInstanceOf(GoogleSecretManagerVault);
    expect(manager.vault.id).toBe("gsm:proj:catladder");
  });

  it("normalizes the string shorthand in getVaultConfig", () => {
    expect(
      getVaultConfig({
        ...config,
        secrets: { vault: "google-secret-manager" },
      } as unknown as Config),
    ).toEqual({ type: "google-secret-manager" });
  });
});
