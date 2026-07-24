/**
 * pure logic of the changesets release method (used by catci in CI):
 * parsing `.changeset/*.md` files, computing the next version from the
 * last release tag and rendering the changelog.
 *
 * Parsing uses the official `@changesets/parse` (the reference
 * implementation of the format), so anything `yarn changeset` writes is
 * read exactly — including quoted values, YAML comments and `none`
 * markers. Unlike the official tooling, versions are NOT read from
 * package.json: catladder projects are applications whose version lives
 * in git tags (`vX.Y.Z`), and some have no root package.json at all —
 * so the package names in the frontmatter are ignored and only the
 * highest bump counts.
 */
import parseChangeset from "@changesets/parse";

export const BUMPS = ["patch", "minor", "major"] as const;
export type Bump = (typeof BUMPS)[number];

const isBump = (type: string): type is Bump =>
  (BUMPS as readonly string[]).includes(type);

export type Changeset = {
  fileName: string;
  bump: Bump;
  summary: string;
};

/**
 * parses one changeset markdown file (official changesets format):
 *
 * ```
 * ---
 * "some-package": minor
 * ---
 *
 * human-written summary
 * ```
 *
 * The frontmatter is parsed by `@changesets/parse` (real YAML), then
 * reduced to a single effective bump: `none` releases are dropped
 * (they intentionally request no version change) and the highest of the
 * rest wins. Throws on files that aren't valid changesets — a malformed
 * file in `.changeset/` is a mistake worth failing the release over,
 * not skipping silently.
 */
export const parseChangesetFile = (
  fileName: string,
  content: string,
): Changeset => {
  let parsed: ReturnType<typeof parseChangeset>;
  try {
    parsed = parseChangeset(content);
  } catch (error) {
    throw new Error(
      `${fileName}: not a valid changeset (${error instanceof Error ? error.message : error})`,
    );
  }
  // ignore `none` — it explicitly requests no release for that package
  const bumps = parsed.releases.map((release) => release.type).filter(isBump);
  if (bumps.length === 0) {
    throw new Error(
      `${fileName}: changeset declares no effective version bump (major|minor|patch)`,
    );
  }
  const summary = parsed.summary.trim();
  if (summary === "") {
    throw new Error(`${fileName}: changeset has no summary`);
  }
  return { fileName, bump: maxBump(bumps), summary };
};

export const maxBump = (bumps: readonly Bump[]): Bump =>
  bumps.reduce((max, bump) =>
    BUMPS.indexOf(bump) > BUMPS.indexOf(max) ? bump : max,
  );

/**
 * the next version, derived from the last release tag (like
 * semantic-release does). No previous tag → first release 1.0.0
 * (matching semantic-release's first release).
 */
export const getNextVersion = (lastTag: string | null, bump: Bump): string => {
  if (lastTag === null) {
    return "1.0.0";
  }
  const match = lastTag.match(/^v(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    throw new Error(
      `last release tag "${lastTag}" is not of the form vX.Y.Z — cannot derive the next version`,
    );
  }
  const [major, minor, patch] = match.slice(1).map(Number);
  switch (bump) {
    case "major":
      return `${major + 1}.0.0`;
    case "minor":
      return `${major}.${minor + 1}.0`;
    case "patch":
      return `${major}.${minor}.${patch + 1}`;
  }
};

const BUMP_HEADINGS: Record<Bump, string> = {
  major: "Major Changes",
  minor: "Minor Changes",
  patch: "Patch Changes",
};

/**
 * the changelog entries for one release, grouped by bump level
 * (mirroring the official changesets changelog layout), without the
 * version heading — also used as the release commit body
 */
export const renderChangelogEntries = (
  changesets: readonly Changeset[],
): string =>
  [...BUMPS]
    .reverse()
    .map((bump) => {
      const entries = changesets.filter((changeset) => changeset.bump === bump);
      if (entries.length === 0) return null;
      return [
        `### ${BUMP_HEADINGS[bump]}`,
        "",
        ...entries.map(
          // indent multi-line summaries so they stay part of the bullet
          (entry) => `- ${entry.summary.replace(/\r?\n/g, "\n  ")}`,
        ),
      ].join("\n");
    })
    .filter((section) => section !== null)
    .join("\n\n");

const CHANGELOG_HEADER = "# Changelog";

/**
 * prepends the release section to the changelog, keeping the
 * `# Changelog` header on top
 */
export const prependToChangelog = (
  existingContent: string | null,
  version: string,
  date: string,
  entries: string,
): string => {
  const section = `## ${version} (${date})\n\n${entries}\n`;
  const previous = (existingContent ?? "")
    .replace(new RegExp(`^${CHANGELOG_HEADER}\\s*\\n`), "")
    .trim();
  return [
    CHANGELOG_HEADER,
    "",
    section + (previous ? "\n" + previous + "\n" : ""),
  ].join("\n");
};
