import { describe, expect, it } from "vitest";
import { isVaultIncompatibleWithLocalAccess } from "../localAccessCompat";

describe("isVaultIncompatibleWithLocalAccess", () => {
  it("refuses gitlab", () => {
    expect(isVaultIncompatibleWithLocalAccess({ type: "gitlab" })).toMatch(
      /CI variable store/,
    );
  });
  it("refuses google-secret-manager", () => {
    expect(
      isVaultIncompatibleWithLocalAccess({ type: "google-secret-manager" }),
    ).toMatch(/google-secret-manager/);
  });
  it("accepts bitwarden", () => {
    expect(
      isVaultIncompatibleWithLocalAccess({ type: "bitwarden" }),
    ).toBeNull();
  });
});
