import { describe, expect, it } from "vitest";
import type { Config } from "../../types";
import { getEnabledPipelineTypes } from "..";

const BASE = {
  customerName: "pan",
  appName: "test-app",
  components: {},
} as unknown as Config;

describe("getEnabledPipelineTypes()", () => {
  it("defaults to gitlab", () => {
    expect(getEnabledPipelineTypes(BASE)).toEqual(["gitlab"]);
  });

  it("respects the deprecated pipelineType", () => {
    expect(
      getEnabledPipelineTypes({ ...BASE, pipelineType: "gitlab" }),
    ).toEqual(["gitlab"]);
  });

  it("uses pipelines when configured", () => {
    expect(
      getEnabledPipelineTypes({ ...BASE, pipelines: { gitlab: true } }),
    ).toEqual(["gitlab"]);
  });

  it("accepts per-pipeline options objects", () => {
    expect(
      getEnabledPipelineTypes({ ...BASE, pipelines: { gitlab: {} } }),
    ).toEqual(["gitlab"]);
  });

  it("throws when pipelines enables nothing", () => {
    expect(() =>
      getEnabledPipelineTypes({ ...BASE, pipelines: { gitlab: false } }),
    ).toThrow(/no pipeline type is enabled/);
  });
});
