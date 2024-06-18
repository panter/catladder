import type { BuildContextStandalone, ComponentContext } from "../../..";
import { createCustomTestJobs } from "../testJob";

describe("createCustomTestJobs", () => {
  const baseContext: ComponentContext<BuildContextStandalone> = {
    name: "testComponent",
    environment: {
      jobOnlyVars: {
        build: {},
      },
    },
    build: {
      config: { type: "custom", docker: { type: "custom" }, jobImage: "" },
    },
  } as ComponentContext<BuildContextStandalone>;

  it("throws error when not build type custom", () => {
    baseContext.build.config.type = "node";
    expect(() => createCustomTestJobs(baseContext)).toThrowError(
      "deploy config is not custom",
    );
    baseContext.build.config.type = "custom";
  });

  it("returns empty array if no audit, lint, and test definition", () => {
    const jobs = createCustomTestJobs(baseContext);
    expect(jobs).toEqual([]);
  });
});
