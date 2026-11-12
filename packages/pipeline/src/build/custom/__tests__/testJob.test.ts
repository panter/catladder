import { describe, it, expect } from "vitest";
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

  it("sets allow_failure on audit job to true by default", () => {
    const context = {
      ...baseContext,
      build: {
        ...baseContext.build,
        config: {
          ...baseContext.build.config,
          audit: { command: "audit-cmd" },
        },
      },
    } as ComponentContext<BuildContextStandalone>;
    const jobs = createCustomTestJobs(context);
    const auditJob = jobs.find((j) => j.name.includes("audit"));
    expect(auditJob?.allow_failure).toBe(true);
  });

  it("respects allowFailure: false on audit job", () => {
    const context = {
      ...baseContext,
      build: {
        ...baseContext.build,
        config: {
          ...baseContext.build.config,
          audit: { command: "audit-cmd", allowFailure: false },
        },
      },
    } as ComponentContext<BuildContextStandalone>;
    const jobs = createCustomTestJobs(context);
    const auditJob = jobs.find((j) => j.name.includes("audit"));
    expect(auditJob?.allow_failure).toBe(false);
  });

  it("passes allowFailure through to lint and test jobs", () => {
    const context = {
      ...baseContext,
      build: {
        ...baseContext.build,
        config: {
          ...baseContext.build.config,
          lint: { command: "lint-cmd", allowFailure: true },
          test: { command: "test-cmd", allowFailure: true },
        },
      },
    } as ComponentContext<BuildContextStandalone>;
    const jobs = createCustomTestJobs(context);
    const lintJob = jobs.find((j) => j.name.includes("lint"));
    const testJob = jobs.find((j) => j.name.includes("test"));
    expect(lintJob?.allow_failure).toBe(true);
    expect(testJob?.allow_failure).toBe(true);
  });

  it("leaves allow_failure undefined on lint and test jobs when not configured", () => {
    const context = {
      ...baseContext,
      build: {
        ...baseContext.build,
        config: {
          ...baseContext.build.config,
          lint: { command: "lint-cmd" },
          test: { command: "test-cmd" },
        },
      },
    } as ComponentContext<BuildContextStandalone>;
    const jobs = createCustomTestJobs(context);
    const lintJob = jobs.find((j) => j.name.includes("lint"));
    const testJob = jobs.find((j) => j.name.includes("test"));
    expect(lintJob?.allow_failure).toBeUndefined();
    expect(testJob?.allow_failure).toBeUndefined();
  });

  it("passes timeout through to audit, lint and test jobs", () => {
    const context = {
      ...baseContext,
      build: {
        ...baseContext.build,
        config: {
          ...baseContext.build.config,
          audit: { command: "audit-cmd", timeout: "5m" },
          lint: { command: "lint-cmd", timeout: "10m" },
          test: { command: "test-cmd", timeout: "1h 30m" },
        },
      },
    } as ComponentContext<BuildContextStandalone>;
    const jobs = createCustomTestJobs(context);
    expect(jobs.find((j) => j.name.includes("audit"))?.timeout).toBe("5m");
    expect(jobs.find((j) => j.name.includes("lint"))?.timeout).toBe("10m");
    expect(jobs.find((j) => j.name.includes("test"))?.timeout).toBe("1h 30m");
  });

  it("leaves timeout undefined when omitted", () => {
    const context = {
      ...baseContext,
      build: {
        ...baseContext.build,
        config: {
          ...baseContext.build.config,
          lint: { command: "lint-cmd" },
        },
      },
    } as ComponentContext<BuildContextStandalone>;
    const jobs = createCustomTestJobs(context);
    expect(jobs.find((j) => j.name.includes("lint"))?.timeout).toBeUndefined();
  });
});
