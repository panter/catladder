import { beforeAll, describe, expect, it, vi } from "vitest";
import type * as DetectPackageManager from "../detectPackageManager";

// the whole module is mocked globally (vitest/setup.ts) so examples can
// pick their package manager — reach for the real implementation here
let parsePackageManagerField: typeof DetectPackageManager.parsePackageManagerField;

beforeAll(async () => {
  ({ parsePackageManagerField } = await vi.importActual<
    typeof DetectPackageManager
  >("../detectPackageManager"));
});

describe("parsePackageManagerField", () => {
  it("reads a plain packageManager field", () => {
    expect(parsePackageManagerField("pnpm@11.6.0")).toEqual({
      type: "pnpm",
      version: "11.6.0",
    });
    expect(parsePackageManagerField("yarn@4.9.1")).toEqual({
      type: "yarn",
      version: "4.9.1",
    });
  });

  it("drops corepack's integrity suffix (not a valid npm spec)", () => {
    expect(
      parsePackageManagerField("pnpm@11.6.0+sha512.abcdef0123456789"),
    ).toEqual({ type: "pnpm", version: "11.6.0" });
  });

  it("keeps a prerelease version intact", () => {
    expect(parsePackageManagerField("pnpm@11.0.0-beta.2")).toEqual({
      type: "pnpm",
      version: "11.0.0-beta.2",
    });
  });

  it("ignores anything it cannot parse", () => {
    expect(parsePackageManagerField(undefined)).toBeNull();
    expect(parsePackageManagerField("npm@11.0.0")).toBeNull();
    expect(parsePackageManagerField("pnpm")).toBeNull();
    expect(parsePackageManagerField("pnpm@+sha512.abc")).toBeNull();
  });
});
