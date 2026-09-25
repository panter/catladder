/**
 * the changeset check CI job (run by catci via the `changesetCheck`
 * script of the `changesets` job image, in MR/PR pipelines only):
 * reports which changesets the merge request adds, what is pending and
 * what version merging would release. The report goes to the job log,
 * to `changeset-report.md` (exposed as an artifact on gitlab) and to a
 * sticky MR/PR comment where a token allows it. Always exits 0: a
 * missing changeset is a warning carried by the report, not a job
 * failure (see the end of {@link changesetCheckJob}).
 */
import { existsSync } from "fs";
import { writeFile } from "fs/promises";
import { CHANGESET_CHECK_MARKER, runChangesetCheck } from "./changesetCheck";
import { readPendingChangesets } from "./changesetsReleaseJob";
import { ensureReleaseHistory, getLastReleaseTag, git } from "./releaseGit";
import { appendStepSummary } from "./stepSummary";

export const CHANGESET_REPORT_FILE = "changeset-report.md";

const onGithub = () => process.env.GITHUB_ACTIONS === "true";

/**
 * the repo's package manager, from the lockfile in the checkout — the
 * hint for adding a changeset should name a command the project has
 */
const detectPackageManager = (): "yarn" | "pnpm" =>
  existsSync("pnpm-lock.yaml") ? "pnpm" : "yarn";

/**
 * the changeset files added by this merge request: diffed against the
 * merge base with the target branch (fetched explicitly — CI checkouts
 * don't carry the target branch). Returns null when there is no MR/PR
 * context to diff against.
 */
const getAddedChangesetFiles = async (): Promise<string[] | null> => {
  const targetBranch = onGithub()
    ? process.env.GITHUB_BASE_REF
    : process.env.CI_MERGE_REQUEST_TARGET_BRANCH_NAME;
  if (!targetBranch) {
    return null;
  }
  await git("fetch", "--quiet", "origin", targetBranch);
  // FETCH_HEAD instead of origin/<branch>: CI remotes don't always
  // carry the standard branch refspec
  const mergeBase = await git("merge-base", "HEAD", "FETCH_HEAD");
  const diff = await git(
    "diff",
    "--name-only",
    "--diff-filter=A",
    mergeBase,
    "HEAD",
  );
  return diff
    .split("\n")
    .filter(
      (file) =>
        file.startsWith(".changeset/") &&
        file.endsWith(".md") &&
        !file.toLowerCase().endsWith("readme.md"),
    )
    .map((file) => file.slice(".changeset/".length));
};

type StickyComment = { id: number; body?: string };

const findSticky = (comments: StickyComment[]): StickyComment | undefined =>
  comments.find((comment) => comment.body?.includes(CHANGESET_CHECK_MARKER));

const request = async (
  url: string,
  init: RequestInit,
): Promise<{ ok: boolean; status: number; json: () => Promise<any> }> => {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(
      `${init.method ?? "GET"} ${url} failed: ${response.status} ${await response.text()}`,
    );
  }
  return response;
};

/**
 * sticky PR comment via the workflow's own token
 * (`permissions: pull-requests: write`)
 */
const upsertGithubComment = async (markdown: string) => {
  const token = process.env.GITHUB_TOKEN;
  const apiUrl = process.env.GITHUB_API_URL ?? "https://api.github.com";
  const repository = process.env.GITHUB_REPOSITORY;
  // pull_request workflows check out refs/pull/<number>/merge
  const prNumber = parseInt(process.env.GITHUB_REF_NAME ?? "");
  if (!token || !repository || !prNumber) {
    console.log("no PR context/token — skipping the PR comment");
    return;
  }
  const headers = {
    authorization: `Bearer ${token}`,
    accept: "application/vnd.github+json",
    "content-type": "application/json",
  };
  const comments: StickyComment[] = await (
    await request(
      `${apiUrl}/repos/${repository}/issues/${prNumber}/comments?per_page=100`,
      { headers },
    )
  ).json();
  const existing = findSticky(comments);
  if (existing) {
    await request(
      `${apiUrl}/repos/${repository}/issues/comments/${existing.id}`,
      {
        method: "PATCH",
        headers,
        body: JSON.stringify({ body: markdown }),
      },
    );
  } else {
    await request(`${apiUrl}/repos/${repository}/issues/${prNumber}/comments`, {
      method: "POST",
      headers,
      body: JSON.stringify({ body: markdown }),
    });
  }
  console.log("updated the sticky PR comment");
};

/**
 * sticky MR note — only when the project makes GL_TOKEN available to
 * MR pipelines (opt-in: an api-scope token in MR pipelines is a
 * security trade-off). Without it the report is still in the job log
 * and the exposed artifact.
 */
const upsertGitlabComment = async (markdown: string) => {
  const token = process.env.GL_TOKEN;
  if (!token) {
    console.log(
      "GL_TOKEN is not available in this pipeline — skipping the MR comment (report available in the job log and the exposed artifact)",
    );
    return;
  }
  const apiUrl = process.env.CI_API_V4_URL;
  const projectId = process.env.CI_PROJECT_ID;
  const mrIid = process.env.CI_MERGE_REQUEST_IID;
  if (!apiUrl || !projectId || !mrIid) {
    console.log("no MR context — skipping the MR comment");
    return;
  }
  const headers = {
    "PRIVATE-TOKEN": token,
    "content-type": "application/json",
  };
  const notesUrl = `${apiUrl}/projects/${projectId}/merge_requests/${mrIid}/notes`;
  const notes: StickyComment[] = await (
    await request(`${notesUrl}?per_page=100`, { headers })
  ).json();
  const existing = findSticky(notes);
  if (existing) {
    await request(`${notesUrl}/${existing.id}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ body: markdown }),
    });
  } else {
    await request(notesUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ body: markdown }),
    });
  }
  console.log("updated the sticky MR comment");
};

export const changesetCheckJob = async () => {
  await ensureReleaseHistory();
  const pending = await readPendingChangesets();
  const lastTag = await getLastReleaseTag();
  const addedFiles = await getAddedChangesetFiles();

  const result = runChangesetCheck({
    addedFiles: addedFiles ?? [],
    pending,
    lastTag,
    requestLabel: onGithub() ? "pull request" : "merge request",
    packageManager: detectPackageManager(),
  });

  console.log(result.markdown.replace(`${CHANGESET_CHECK_MARKER}\n`, ""));
  await writeFile(CHANGESET_REPORT_FILE, result.markdown);

  // a failed comment must not fail the check — the report has already
  // been printed and written
  try {
    if (onGithub()) {
      await upsertGithubComment(result.markdown);
    } else {
      await upsertGitlabComment(result.markdown);
    }
  } catch (error) {
    console.warn(`could not update the sticky comment: ${error}`);
  }

  if (addedFiles === null) {
    console.log("not running against a merge request — check skipped");
    return;
  }
  if (!result.addsChangeset) {
    // the job stays green on both platforms — the report, the log and
    // the sticky comment carry the "no changeset" warning instead:
    // - github has no "warning" job state: exiting non-zero would show
    //   the job as failed (a red ❌ and "exit code 1"), which reads
    //   like something broke.
    // - gitlab only resolves the exposed artifact (the MR widget's
    //   "changeset report" link) of a SUCCESSFUL job: for a failed
    //   allow_failure job `exposed_artifacts.json` answers 204 forever
    //   and the widget spins on "Loading artifacts" — exactly on the
    //   MRs that need the report.
    if (onGithub()) {
      console.log(
        "::warning title=No changeset::this pull request adds no changeset — " +
          "if the change is user-facing, add one so it appears in the next release's changelog",
      );
      appendStepSummary(
        result.markdown.replace(`${CHANGESET_CHECK_MARKER}\n`, ""),
      );
    } else {
      console.log(
        "⚠️  this merge request adds no changeset — if the change is user-facing, " +
          "add one so it appears in the next release's changelog (see the changeset report)",
      );
    }
  }
};
