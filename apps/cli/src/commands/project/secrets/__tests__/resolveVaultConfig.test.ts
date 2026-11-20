import type { Config } from "@catladder/pipeline";
import { describe, expect, it } from "vitest";
import { resolveVaultConfig } from "../resolveVaultConfig";

const configWith = (vault?: unknown) =>
  ({ secrets: vault === undefined ? undefined : { vault } }) as Config;

describe("resolveVaultConfig", () => {
  it("resolves gitlab regardless of options", () => {
    expect(
      resolveVaultConfig("gitlab", { collection: "x" }, configWith()),
    ).toEqual({ type: "gitlab" });
  });

  it("uses the collection flag for bitwarden", () => {
    expect(
      resolveVaultConfig("bitwarden", { collection: "team" }, configWith()),
    ).toEqual({ type: "bitwarden", collection: "team" });
  });

  it("falls back to the configured bitwarden collection", () => {
    expect(
      resolveVaultConfig(
        "bitwarden",
        {},
        configWith({ type: "bitwarden", collection: "configured" }),
      ),
    ).toEqual({ type: "bitwarden", collection: "configured" });
  });

  it("does not fall back when the configured vault has another type", () => {
    expect(resolveVaultConfig("bitwarden", {}, configWith("gitlab"))).toEqual({
      type: "bitwarden",
    });
  });

  it("prefers the flag over the configured collection", () => {
    expect(
      resolveVaultConfig(
        "bitwarden",
        { collection: "flag" },
        configWith({ type: "bitwarden", collection: "configured" }),
      ),
    ).toEqual({ type: "bitwarden", collection: "flag" });
  });
});
