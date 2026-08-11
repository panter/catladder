import { describe, expect, it } from "vitest";
import type { Changeset } from "../changesets";
import { CHANGESET_CHECK_MARKER, runChangesetCheck } from "../changesetCheck";

const changeset = (bump: Changeset["bump"], summary: string): Changeset => ({
  fileName: `${summary.toLowerCase().replace(/\s+/g, "-")}.md`,
  bump,
  summary,
});

describe("runChangesetCheck", () => {
  it("reports an added changeset and the resulting version", () => {
    const result = runChangesetCheck({
      addedFiles: ["fancy-dashboard.md"],
      pending: [changeset("minor", "Add the fancy dashboard")],
      lastTag: "v4.7.0",
      requestLabel: "merge request",
      packageManager: "yarn",
    });
    expect(result.addsChangeset).toBe(true);
    expect(result.markdown).toContain(CHANGESET_CHECK_MARKER);
    expect(result.markdown).toContain("✅ This merge request adds 1 changeset");
    expect(result.markdown).toContain("`fancy-dashboard.md`");
    expect(result.markdown).toContain("**v4.8.0**");
    expect(result.markdown).toContain("(from v4.7.0)");
    expect(result.markdown).toContain("Add the fancy dashboard");
  });

  it("warns when the merge request adds no changeset", () => {
    const result = runChangesetCheck({
      addedFiles: [],
      pending: [],
      lastTag: "v4.7.0",
      requestLabel: "merge request",
      packageManager: "yarn",
    });
    expect(result.addsChangeset).toBe(false);
    expect(result.markdown).toContain(
      "**This merge request adds no changeset.**",
    );
    expect(result.markdown).toContain("will **not** trigger a release");
  });

  it("still previews earlier pending changesets when this MR adds none", () => {
    const result = runChangesetCheck({
      addedFiles: [],
      pending: [
        changeset("major", "Remove the legacy mode"),
        changeset("patch", "Fix a leak"),
      ],
      lastTag: "v4.7.0",
      requestLabel: "merge request",
      packageManager: "yarn",
    });
    expect(result.addsChangeset).toBe(false);
    expect(result.markdown).toContain("2 changesets are pending");
    expect(result.markdown).toContain("**v5.0.0**");
    expect(result.markdown).toContain("Remove the legacy mode");
  });

  it("names the project's own package manager in the how-to hint", () => {
    const forPm = (packageManager: "yarn" | "pnpm") =>
      runChangesetCheck({
        addedFiles: [],
        pending: [],
        lastTag: "v4.7.0",
        requestLabel: "merge request",
        packageManager,
      }).markdown;
    expect(forPm("pnpm")).toContain("`pnpm changeset`");
    expect(forPm("pnpm")).not.toContain("yarn");
    expect(forPm("yarn")).toContain("`yarn changeset`");
  });

  it("handles the first release (no previous tag)", () => {
    const result = runChangesetCheck({
      addedFiles: ["init.md"],
      pending: [changeset("minor", "Initial feature")],
      lastTag: null,
      requestLabel: "pull request",
      packageManager: "yarn",
    });
    expect(result.markdown).toContain("✅ This pull request adds 1 changeset");
    expect(result.markdown).toContain("**v1.0.0**");
    expect(result.markdown).toContain("(first release)");
  });
});
