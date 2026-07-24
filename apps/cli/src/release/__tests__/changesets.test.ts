import { describe, expect, it } from "vitest";
import {
  getNextVersion,
  maxBump,
  parseChangesetFile,
  prependToChangelog,
  renderChangelogEntries,
} from "../changesets";

describe("parseChangesetFile", () => {
  it("parses the official changesets format", () => {
    const changeset = parseChangesetFile(
      "brave-lions-smile.md",
      '---\n"my-app": minor\n---\n\nAdd the fancy new dashboard\n',
    );
    expect(changeset).toEqual({
      fileName: "brave-lions-smile.md",
      bump: "minor",
      summary: "Add the fancy new dashboard",
    });
  });

  it("takes the highest bump when multiple packages are declared", () => {
    const changeset = parseChangesetFile(
      "x.md",
      '---\n"pkg-a": patch\n"pkg-b": major\n---\nbreaking rework\n',
    );
    expect(changeset.bump).toBe("major");
  });

  it("accepts unquoted package names", () => {
    const changeset = parseChangesetFile(
      "x.md",
      "---\nmy-app: patch\n---\nfix it\n",
    );
    expect(changeset.bump).toBe("patch");
  });

  // format details handled by @changesets/parse (real YAML) that the
  // previous hand-rolled regex parser got wrong:

  it("accepts quoted bump values", () => {
    const changeset = parseChangesetFile(
      "x.md",
      '---\n"my-app": "minor"\n---\nsummary\n',
    );
    expect(changeset.bump).toBe("minor");
  });

  it("ignores `none` releases and uses the highest real bump", () => {
    const changeset = parseChangesetFile(
      "x.md",
      '---\n"pkg-a": none\n"pkg-b": minor\n---\nsummary\n',
    );
    expect(changeset.bump).toBe("minor");
  });

  it("ignores yaml comments in the frontmatter", () => {
    const changeset = parseChangesetFile(
      "x.md",
      '---\n# only bumping the app\n"my-app": patch\n---\nfix it\n',
    );
    expect(changeset.bump).toBe("patch");
  });

  it("throws on a file without frontmatter", () => {
    expect(() => parseChangesetFile("x.md", "just some text")).toThrow(
      /not a valid changeset/,
    );
  });

  it("throws on an invalid bump", () => {
    expect(() =>
      parseChangesetFile("x.md", '---\n"my-app": huge\n---\nsummary\n'),
    ).toThrow(/not a valid changeset/);
  });

  it("throws on an empty summary", () => {
    expect(() =>
      parseChangesetFile("x.md", '---\n"my-app": patch\n---\n\n'),
    ).toThrow(/no summary/);
  });

  it("throws when the changeset declares no effective bump (all none)", () => {
    expect(() =>
      parseChangesetFile("x.md", '---\n"pkg-a": none\n---\nsummary\n'),
    ).toThrow(/no effective version bump/);
  });

  it("throws when the frontmatter is empty", () => {
    expect(() => parseChangesetFile("x.md", "---\n---\nsummary\n")).toThrow(
      /no effective version bump/,
    );
  });
});

describe("maxBump", () => {
  it("orders patch < minor < major", () => {
    expect(maxBump(["patch"])).toBe("patch");
    expect(maxBump(["patch", "minor", "patch"])).toBe("minor");
    expect(maxBump(["minor", "major", "patch"])).toBe("major");
  });
});

describe("getNextVersion", () => {
  it("starts at 1.0.0 without a previous tag (like semantic-release)", () => {
    expect(getNextVersion(null, "patch")).toBe("1.0.0");
  });

  it("bumps from the last tag", () => {
    expect(getNextVersion("v1.2.3", "patch")).toBe("1.2.4");
    expect(getNextVersion("v1.2.3", "minor")).toBe("1.3.0");
    expect(getNextVersion("v1.2.3", "major")).toBe("2.0.0");
  });

  it("rejects tags that are not plain vX.Y.Z", () => {
    expect(() => getNextVersion("v1.2.3-beta.1", "patch")).toThrow(
      /not of the form vX\.Y\.Z/,
    );
  });
});

describe("renderChangelogEntries", () => {
  it("groups by bump level, highest first", () => {
    const entries = renderChangelogEntries([
      { fileName: "a.md", bump: "patch", summary: "fix a leak" },
      { fileName: "b.md", bump: "major", summary: "drop old api" },
      { fileName: "c.md", bump: "patch", summary: "fix a typo" },
    ]);
    expect(entries).toBe(
      [
        "### Major Changes",
        "",
        "- drop old api",
        "",
        "### Patch Changes",
        "",
        "- fix a leak",
        "- fix a typo",
      ].join("\n"),
    );
  });

  it("indents multi-line summaries into the bullet", () => {
    const entries = renderChangelogEntries([
      { fileName: "a.md", bump: "minor", summary: "first line\nsecond line" },
    ]);
    expect(entries).toBe("### Minor Changes\n\n- first line\n  second line");
  });
});

describe("prependToChangelog", () => {
  it("creates a fresh changelog", () => {
    expect(prependToChangelog(null, "1.0.0", "2026-07-20", "- initial")).toBe(
      "# Changelog\n\n## 1.0.0 (2026-07-20)\n\n- initial\n",
    );
  });

  it("prepends to an existing changelog below the header", () => {
    const existing = "# Changelog\n\n## 1.0.0 (2026-01-01)\n\n- initial\n";
    expect(
      prependToChangelog(existing, "1.1.0", "2026-07-20", "- new stuff"),
    ).toBe(
      "# Changelog\n\n## 1.1.0 (2026-07-20)\n\n- new stuff\n\n" +
        "## 1.0.0 (2026-01-01)\n\n- initial\n",
    );
  });
});
