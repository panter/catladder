import { describe, expect, it } from "vitest";
import type { Config } from "../../../types";
import {
  GHCR_REPOSITORY_EXPRESSION,
  parseGithubRepoFromRemoteUrl,
  toGhcrRegistryImage,
} from "../ghcr";
import { githubRegistryImageFromConfig } from "../registryImage";

const configWith = (github: Record<string, unknown>): Config =>
  ({ pipelines: { github } }) as unknown as Config;

describe("parseGithubRepoFromRemoteUrl", () => {
  it.each([
    ["git@github.com:AcmeCorp/nautilus.git\n", "AcmeCorp/nautilus"],
    ["https://github.com/AcmeCorp/nautilus.git\n", "AcmeCorp/nautilus"],
    ["https://github.com/AcmeCorp/nautilus\n", "AcmeCorp/nautilus"],
    ["ssh://git@github.com/acme/my.repo.git\n", "acme/my.repo"],
  ])("parses %j", (url, expected) => {
    expect(parseGithubRepoFromRemoteUrl(url)).toBe(expected);
  });

  it("returns undefined for a non-github remote", () => {
    expect(
      parseGithubRepoFromRemoteUrl("git@gitlab.com:acme/nautilus.git\n"),
    ).toBeUndefined();
  });
});

describe("toGhcrRegistryImage", () => {
  it("lowercases a mixed-case repository into a literal", () => {
    expect(toGhcrRegistryImage("AcmeCorp/Nautilus")).toBe(
      "ghcr.io/acmecorp/nautilus",
    );
  });

  it("keeps the actions expression when lowercasing changes nothing", () => {
    // the expression stays portable across forks, so an all-lowercase
    // repository must not be pinned to a literal
    expect(toGhcrRegistryImage("acme/nautilus")).toBe(
      GHCR_REPOSITORY_EXPRESSION,
    );
  });
});

describe("githubRegistryImageFromConfig", () => {
  it("uses the configured repository", () => {
    expect(
      githubRegistryImageFromConfig(
        configWith({ repository: "FiulAG/nautilus" }),
      ),
    ).toBe("ghcr.io/fiulag/nautilus");
  });

  it("is undefined without a configured repository, so git is consulted", () => {
    expect(githubRegistryImageFromConfig(configWith({}))).toBeUndefined();
    expect(githubRegistryImageFromConfig({} as Config)).toBeUndefined();
  });
});
