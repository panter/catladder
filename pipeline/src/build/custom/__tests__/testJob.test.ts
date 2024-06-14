import type { Context } from "../../..";
import { createCustomTestJobs } from "../testJob";

describe("createCustomTestJobs", () => {
  const componentConfig: Context["componentConfig"] = {
    dir: ".",
    build: { type: "custom", docker: { type: "custom" }, jobImage: "" },
    deploy: {},
  } as Context["componentConfig"];
  const baseContext: Context = {
    componentName: "testComponent",
    environment: {
      jobOnlyVars: {
        build: {},
      },
    },
    componentConfig,
  } as Context;

  it("throws error when not build type custom", () => {
    componentConfig.build.type = "node";
    expect(() => createCustomTestJobs(baseContext)).toThrowError(
      "deploy config is not custom",
    );
    componentConfig.build.type = "custom";
  });

  it("returns empty array if no audit, lint, and test definition", () => {
    const jobs = createCustomTestJobs(baseContext);
    expect(jobs).toEqual([]);
  });
});
