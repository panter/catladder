import { describe, expect, it } from "vitest";
import { computeNpmPublishPlan, slugifyRef } from "../npmPublishPlan";
import { parseNpmPublishArgs } from "../npmPublishJob";

describe("computeNpmPublishPlan", () => {
  it("publishes the tag version as latest for prod", () => {
    expect(
      computeNpmPublishPlan({
        envType: "prod",
        ciTag: "v5.1.2",
        refSlug: "v5-1-2",
        shortSha: "abcd1234",
      }),
    ).toEqual({ version: "5.1.2", distTag: "latest" });
  });

  it("fails for prod without a git tag", () => {
    expect(() =>
      computeNpmPublishPlan({
        envType: "prod",
        ciTag: null,
        refSlug: "main",
        shortSha: "abcd1234",
      }),
    ).toThrow(/tagged-release/);
  });

  it("publishes branch canaries under the canary dist-tag", () => {
    expect(
      computeNpmPublishPlan({
        envType: "dev",
        ciTag: null,
        refSlug: "main",
        shortSha: "abcd1234",
      }),
    ).toEqual({ version: "0.0.0-main-abcd1234", distTag: "canary" });
  });

  it("publishes MR canaries (review env) under the canary dist-tag", () => {
    expect(
      computeNpmPublishPlan({
        envType: "review",
        ciTag: null,
        refSlug: "feat-cool-thing",
        shortSha: "abcd1234",
      }),
    ).toEqual({ version: "0.0.0-feat-cool-thing-abcd1234", distTag: "canary" });
  });

  it("gives next/beta branches their own dist-tag", () => {
    expect(
      computeNpmPublishPlan({
        envType: "dev",
        ciTag: null,
        refSlug: "next",
        shortSha: "abcd1234",
      }),
    ).toEqual({ version: "0.0.0-next-abcd1234", distTag: "next" });
    expect(
      computeNpmPublishPlan({
        envType: "dev",
        ciTag: null,
        refSlug: "beta",
        shortSha: "abcd1234",
      }).distTag,
    ).toBe("beta");
  });

  it("lets an explicit dist-tag override the derivation", () => {
    expect(
      computeNpmPublishPlan({
        envType: "dev",
        ciTag: null,
        refSlug: "main",
        shortSha: "abcd1234",
        distTagOverride: "nightly",
      }).distTag,
    ).toBe("nightly");
    expect(
      computeNpmPublishPlan({
        envType: "prod",
        ciTag: "v2.0.0",
        refSlug: "v2-0-0",
        shortSha: "abcd1234",
        distTagOverride: "lts",
      }).distTag,
    ).toBe("lts");
  });
});

describe("slugifyRef", () => {
  it("mirrors gitlab's ref slug derivation", () => {
    expect(slugifyRef("feat/My_Cool-Branch!")).toBe("feat-my-cool-branch");
    expect(slugifyRef("main")).toBe("main");
    expect(slugifyRef("-weird--")).toBe("weird");
  });
});

describe("parseNpmPublishArgs", () => {
  it("parses the generated flag list", () => {
    expect(
      parseNpmPublishArgs([
        "--dir",
        "apps/cli",
        "--env-type",
        "dev",
        "--access",
        "public",
      ]),
    ).toEqual({
      dir: "apps/cli",
      envType: "dev",
      access: "public",
      registry: undefined,
      distTag: undefined,
    });
  });

  it("rejects missing required flags", () => {
    expect(parseNpmPublishArgs(["--dir", "apps/cli"])).toBeNull();
    expect(parseNpmPublishArgs(["--dir"])).toBeNull();
  });
});
