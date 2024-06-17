import type { ComponentContext } from "../../..";
import { createCustomTestJobs } from "../testJob";

describe("createCustomTestJobs", () => {
  const componentConfig: ComponentContext["componentConfig"] = {
    dir: ".",
    build: { type: "custom", docker: { type: "custom" }, jobImage: "" },
    deploy: {},
  } as ComponentContext["componentConfig"];
  const baseContext: ComponentContext = {
    componentName: "testComponent",
    environment: {
      jobOnlyVars: {
        build: {},
      },
    },
    componentConfig,
  } as ComponentContext;

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
