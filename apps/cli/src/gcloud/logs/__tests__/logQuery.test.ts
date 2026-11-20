import { describe, expect, it } from "vitest";
import { buildLogFilter, formatLogEntry, parseSince } from "../logQuery";

describe("buildLogFilter", () => {
  it("filters a service", () => {
    expect(buildLogFilter({ kind: "service", name: "acme-app-dev-web" })).toBe(
      'resource.type="cloud_run_revision" AND resource.labels.service_name="acme-app-dev-web"',
    );
  });

  it("accepts the execution suffix and the full name for jobs", () => {
    const target = { kind: "job", name: "acme-app-dev-web-migrate" } as const;
    const expected =
      'resource.type="cloud_run_job" AND resource.labels.job_name="acme-app-dev-web-migrate" AND labels."run.googleapis.com/execution_name"="acme-app-dev-web-migrate-r8hjv"';
    expect(buildLogFilter(target, { execution: "r8hjv" })).toBe(expected);
    expect(
      buildLogFilter(target, { execution: "acme-app-dev-web-migrate-r8hjv" }),
    ).toBe(expected);
  });

  it("needs a job for an execution", () => {
    expect(() =>
      buildLogFilter({ kind: "service", name: "a" }, { execution: "x" }),
    ).toThrow(/--job/);
  });

  it("rejects values that could escape the filter", () => {
    expect(() =>
      buildLogFilter(
        { kind: "job", name: "a" },
        { execution: 'x" OR severity>=DEFAULT' },
      ),
    ).toThrow();
    expect(() =>
      buildLogFilter({ kind: "service", name: "a" }, { severity: "x OR y" }),
    ).toThrow(/unknown severity/);
  });

  it("adds a case insensitive minimum severity", () => {
    expect(
      buildLogFilter({ kind: "service", name: "a" }, { severity: "error" }),
    ).toMatch(/ AND severity>=ERROR$/);
  });
});

describe("parseSince", () => {
  it("converts to iso durations", () => {
    expect(parseSince("45s")).toBe("PT45S");
    expect(parseSince("30m")).toBe("PT30M");
    expect(parseSince("1h")).toBe("PT1H");
    expect(parseSince("2d")).toBe("P2D");
  });
  it("rejects anything else", () => {
    expect(() => parseSince("soon")).toThrow();
  });
});

describe("formatLogEntry", () => {
  it("prints text, json message and falls back to the payload", () => {
    expect(
      formatLogEntry({
        timestamp: "t",
        severity: "ERROR",
        textPayload: "boom",
      }),
    ).toBe("t ERROR   boom");
    expect(
      formatLogEntry({ timestamp: "t", jsonPayload: { message: "hi" } }),
    ).toBe("t DEFAULT hi");
    expect(formatLogEntry({ timestamp: "t", jsonPayload: { a: 1 } })).toBe(
      't DEFAULT {"a":1}',
    );
  });
});
