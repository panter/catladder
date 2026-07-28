/**
 * the changesets release CI job (run by catci via the
 * `changesetsRelease` script of the `changesets` job image):
 * consumes pending `.changeset/*.md` files, bumps the version derived
 * from the last `v*` tag, writes the changelog, commits, tags and
 * pushes — the pushed tag triggers the taggedRelease pipeline.
 */
import { readFile, readdir, rm, writeFile } from "fs/promises";
import { join } from "path";
import type { Changeset } from "./changesets";
import {
  getNextVersion,
  maxBump,
  parseChangesetFile,
  prependToChangelog,
  renderChangelogEntries,
} from "./changesets";
import { ensureReleaseHistory, getLastReleaseTag, git } from "./releaseGit";
import { appendStepSummary } from "./stepSummary";

const CHANGESET_DIR = ".changeset";
const CHANGELOG_FILE = "CHANGELOG.md";

/**
 * the generated taggedRelease workflow (dispatched after the tag push,
 * see dispatchTaggedReleaseWorkflow). Keep in sync with
 * `workflowFileName` in pipeline/src/backends/github/GithubBackend.ts.
 */
const GITHUB_TAGGED_RELEASE_WORKFLOW = "catladder-release.yml";

export const readPendingChangesets = async () => {
  const entries = await readdir(CHANGESET_DIR).catch(() => []);
  const files = entries.filter(
    (file) => file.endsWith(".md") && file.toLowerCase() !== "readme.md",
  );
  return Promise.all(
    files.map(async (file) =>
      parseChangesetFile(
        file,
        await readFile(join(CHANGESET_DIR, file), "utf-8"),
      ),
    ),
  );
};

const ensureGitIdentity = async () => {
  const email = await git("config", "user.email").catch(() => "");
  if (email !== "") return;
  const onGithub = process.env.GITHUB_ACTIONS === "true";
  await git(
    "config",
    "user.name",
    onGithub ? "github-actions[bot]" : "catladder",
  );
  await git(
    "config",
    "user.email",
    onGithub
      ? "41898282+github-actions[bot]@users.noreply.github.com"
      : "catladder-release@panter.ch",
  );
};

const requireEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set — cannot push the release`);
  }
  return value;
};

/**
 * pushes the release commit and tag.
 * - gitlab: CI checkouts have a read-only origin, so push via an
 *   authenticated url with GL_TOKEN (the same project access token
 *   semantic-release uses)
 * - github: actions/checkout persists the job token credentials, so a
 *   plain push to origin works (`permissions: contents: write`)
 */
const pushCommitAndTag = async (tag: string) => {
  // --atomic: all refs or none — a rejected tag must not leave the
  // release commit half-pushed (observed when a stale local view
  // rederived an existing version)
  if (process.env.GITHUB_ACTIONS === "true") {
    const branch = requireEnv("GITHUB_REF_NAME");
    await git("push", "--atomic", "origin", `HEAD:refs/heads/${branch}`, tag);
    return;
  }
  const token = requireEnv("GL_TOKEN");
  const host = requireEnv("CI_SERVER_HOST");
  const projectPath = requireEnv("CI_PROJECT_PATH");
  const branch = requireEnv("CI_COMMIT_BRANCH");
  const remote = `https://oauth2:${token}@${host}/${projectPath}.git`;
  await git("push", "--atomic", remote, `HEAD:refs/heads/${branch}`, tag);
};

/**
 * tags pushed with the default GITHUB_TOKEN do not trigger `on: push:
 * tags` workflows (github's recursion guard), so the taggedRelease
 * workflow is dispatched explicitly for the new tag
 * (`permissions: actions: write`; workflow_dispatch created BY the
 * token does run)
 */
export const dispatchTaggedReleaseWorkflow = async (tag: string) => {
  const apiUrl = process.env.GITHUB_API_URL ?? "https://api.github.com";
  const repository = requireEnv("GITHUB_REPOSITORY");
  const token = requireEnv("GITHUB_TOKEN");
  const response = await fetch(
    `${apiUrl}/repos/${repository}/actions/workflows/${GITHUB_TAGGED_RELEASE_WORKFLOW}/dispatches`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/vnd.github+json",
      },
      body: JSON.stringify({ ref: tag }),
    },
  );
  if (!response.ok) {
    throw new Error(
      `dispatching ${GITHUB_TAGGED_RELEASE_WORKFLOW} for ${tag} failed: ${response.status} ${await response.text()}`,
    );
  }
  console.log(`dispatched ${GITHUB_TAGGED_RELEASE_WORKFLOW} for ${tag}`);
};

/**
 * the escape hatch of the force-release job: releasing without pending
 * changesets (e.g. a hotfix merged without one) must not require a new
 * MR, so a forced empty release becomes a patch bump with a generic
 * changelog entry instead of a no-op
 */
const FORCED_RELEASE_CHANGESET: Changeset = {
  fileName: "",
  bump: "patch",
  summary: "Forced release without pending changesets.",
};

export const changesetsReleaseJob = async () => {
  const pending = await readPendingChangesets();
  const forcedEmpty =
    pending.length === 0 && process.env.CATLADDER_FORCE_RELEASE === "true";
  if (pending.length === 0 && !forcedEmpty) {
    console.log(
      `no changesets found in ${CHANGESET_DIR}/ — nothing to release`,
    );
    console.log(
      "add one with `yarn changeset` (or write .changeset/<name>.md by hand) and merge it to release",
    );
    console.log(
      "to release anyway (patch bump), run the force release job instead",
    );
    appendStepSummary(
      `ℹ️ **Nothing released** — no pending changesets in \`${CHANGESET_DIR}/\`. ` +
        "Merge a changeset and release again, or force the release for a patch bump.",
    );
    return;
  }
  const changesets = forcedEmpty ? [FORCED_RELEASE_CHANGESET] : pending;
  if (forcedEmpty) {
    console.log("no changesets pending — forced release, bumping a patch");
  }

  await ensureReleaseHistory();
  const lastTag = await getLastReleaseTag();
  const version = getNextVersion(
    lastTag,
    maxBump(changesets.map((c) => c.bump)),
  );
  const tag = `v${version}`;
  console.log(
    `releasing ${tag} (${lastTag ?? "first release"} + ${changesets.length} changeset(s))`,
  );

  const entries = renderChangelogEntries(changesets);
  const existingChangelog = await readFile(CHANGELOG_FILE, "utf-8").catch(
    () => null,
  );
  const date = new Date().toISOString().slice(0, 10);
  await writeFile(
    CHANGELOG_FILE,
    prependToChangelog(existingChangelog, version, date, entries),
  );
  await Promise.all(
    // pending, not changesets: the synthetic forced-release changeset
    // has no file to delete
    pending.map((changeset) => rm(join(CHANGESET_DIR, changeset.fileName))),
  );

  await ensureGitIdentity();
  // a forced empty release consumes no changeset files — and .changeset/
  // may not even exist yet, which `git add` would reject
  if (forcedEmpty) {
    await git("add", CHANGELOG_FILE);
  } else {
    await git("add", CHANGELOG_FILE, CHANGESET_DIR);
  }
  await git("commit", "-m", `chore(release): ${version}\n\n${entries}`);
  await git("tag", tag);
  await pushCommitAndTag(tag);
  console.log(`released ${tag}`);
  appendStepSummary(`🚀 **Released ${tag}**\n\n${entries}`);

  if (process.env.GITHUB_ACTIONS === "true") {
    await dispatchTaggedReleaseWorkflow(tag);
  }
};
