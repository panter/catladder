/**
 * pure logic of the changeset check (run in MR/PR pipelines by catci):
 * given the changesets added by the merge request and everything
 * pending on the branch, render the markdown report shown as job
 * output, exposed artifact and sticky MR/PR comment.
 */
import type { Changeset } from "./changesets";
import { getNextVersion, maxBump, renderChangelogEntries } from "./changesets";

/**
 * identifies the sticky comment across pushes: the check finds the
 * existing comment carrying this marker and updates it in place
 * instead of posting a new one
 */
export const CHANGESET_CHECK_MARKER = "<!-- catladder-changeset-check -->";

export type ChangesetCheckInput = {
  /**
   * file names of changesets ADDED by this merge request (relative to
   * `.changeset/`)
   */
  addedFiles: string[];
  /**
   * all changesets pending on this branch (added here or merged
   * earlier and not yet released)
   */
  pending: Changeset[];
  lastTag: string | null;
  /** platform wording: "merge request" (gitlab) or "pull request" (github) */
  requestLabel: string;
};

export type ChangesetCheckResult = {
  /** whether this merge request adds at least one changeset */
  addsChangeset: boolean;
  /** the full report, marker included (comment + artifact body) */
  markdown: string;
};

export const runChangesetCheck = ({
  addedFiles,
  pending,
  lastTag,
  requestLabel,
}: ChangesetCheckInput): ChangesetCheckResult => {
  const addsChangeset = addedFiles.length > 0;

  const lines: string[] = [CHANGESET_CHECK_MARKER, "## 🦋 Changeset check", ""];

  if (addsChangeset) {
    lines.push(
      `✅ This ${requestLabel} adds ${addedFiles.length} changeset${addedFiles.length === 1 ? "" : "s"}: ${addedFiles.map((f) => `\`${f}\``).join(", ")}`,
    );
  } else {
    lines.push(
      `⚠️ **This ${requestLabel} adds no changeset.** If the change is user-facing it will be missing from the next release's changelog — add \`.changeset/<name>.md\` (or run \`yarn changeset\`). For docs/chore changes this warning can be ignored.`,
    );
  }
  lines.push("");

  if (pending.length === 0) {
    lines.push(
      "No changesets are pending — merging will **not** trigger a release.",
    );
  } else {
    const version = getNextVersion(
      lastTag,
      maxBump(pending.map((c) => c.bump)),
    );
    lines.push(
      `${pending.length} changeset${pending.length === 1 ? " is" : "s are"} pending after merge — the next release will be **v${version}**${lastTag ? ` (from ${lastTag})` : " (first release)"}:`,
      "",
      "<details><summary>Changelog preview</summary>",
      "",
      renderChangelogEntries(pending),
      "",
      "</details>",
    );
  }

  return { addsChangeset, markdown: lines.join("\n") };
};
