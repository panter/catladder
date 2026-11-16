import { describe, it, expect } from "vitest";
import { parseDurationToMinutes } from "../duration";

describe("parseDurationToMinutes", () => {
  it.each([
    ["10m", 10],
    ["1h 30m", 90],
    ["1h30m", 90],
    ["90 minutes", 90],
    ["1 hour 30 minutes", 90],
    ["30s", 1],
    ["61s", 2],
    ["1d", 1440],
    ["1w", 10080],
  ])("parses %s to %i minutes", (value, minutes) => {
    expect(parseDurationToMinutes(value, "job")).toBe(minutes);
  });

  it.each(["soon", "", "600", "10x", "m10", "10m foo"])(
    "rejects %j naming the job",
    (value) => {
      expect(() => parseDurationToMinutes(value, "my-job")).toThrowError(
        /job "my-job": invalid timeout/,
      );
    },
  );
});
