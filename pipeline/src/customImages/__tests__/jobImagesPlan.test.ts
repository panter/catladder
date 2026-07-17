import { describe, expect, it } from "vitest";
import type { Config } from "../../types";
import { getJobImagesMode } from "../jobImagesPlan";

const BASE = {
  customerName: "pan",
  appName: "test-app",
  components: {},
} as unknown as Config;

describe("getJobImagesMode()", () => {
  it("defaults to central on gitlab", () => {
    expect(getJobImagesMode(BASE, "gitlab")).toBe("central");
  });

  it("defaults to repo on github", () => {
    expect(getJobImagesMode(BASE, "github")).toBe("repo");
  });

  it("respects an explicit mode on gitlab", () => {
    expect(getJobImagesMode({ ...BASE, jobImages: "repo" }, "gitlab")).toBe(
      "repo",
    );
    expect(getJobImagesMode({ ...BASE, jobImages: "central" }, "gitlab")).toBe(
      "central",
    );
  });

  it("allows an explicit repo mode on github", () => {
    expect(getJobImagesMode({ ...BASE, jobImages: "repo" }, "github")).toBe(
      "repo",
    );
  });

  it("rejects central mode on github", () => {
    expect(() =>
      getJobImagesMode({ ...BASE, jobImages: "central" }, "github"),
    ).toThrow(/not supported on github/);
  });
});
