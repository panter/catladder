/**
 * the release entry on the git host — gitlab's `/-/releases`, github's
 * `/releases`. Pushing a tag does NOT create one: on the
 * semantic-release path `@semantic-release/gitlab` used to do it, the
 * changesets path creates it here (on both backends).
 *
 * Never fatal: when this runs, the release commit and tag are already
 * pushed and the taggedRelease pipeline is on its way — a failing api
 * call must not turn a done release into a red job (and a rerun would
 * fail on the existing tag).
 */

const post = async (
  url: string,
  headers: Record<string, string>,
  body: unknown,
) => {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(
      `POST ${url} failed: ${response.status} ${await response.text()}`,
    );
  }
};

/**
 * GL_TOKEN is the project access token the release push already used,
 * so its api scope is available here too
 */
const createGitlabReleaseEntry = async (tag: string, notes: string) => {
  const token = process.env.GL_TOKEN;
  const apiUrl = process.env.CI_API_V4_URL;
  const projectId = process.env.CI_PROJECT_ID;
  if (!token || !apiUrl || !projectId) {
    console.warn(
      "no GL_TOKEN / gitlab api context — skipping the release entry (the tag is pushed)",
    );
    return;
  }
  await post(
    `${apiUrl}/projects/${projectId}/releases`,
    { "PRIVATE-TOKEN": token },
    // name defaults to the tag on gitlab
    { tag_name: tag, description: notes },
  );
  console.log(`created the gitlab release entry for ${tag}`);
};

/** the workflow token, granted `contents: write` by the release job */
const createGithubReleaseEntry = async (tag: string, notes: string) => {
  const token = process.env.GITHUB_TOKEN;
  const apiUrl = process.env.GITHUB_API_URL ?? "https://api.github.com";
  const repository = process.env.GITHUB_REPOSITORY;
  if (!token || !repository) {
    console.warn(
      "no GITHUB_TOKEN / repository context — skipping the release entry (the tag is pushed)",
    );
    return;
  }
  await post(
    `${apiUrl}/repos/${repository}/releases`,
    { authorization: `Bearer ${token}`, accept: "application/vnd.github+json" },
    { tag_name: tag, name: tag, body: notes },
  );
  console.log(`created the github release entry for ${tag}`);
};

export const createReleaseEntry = async (tag: string, notes: string) => {
  try {
    if (process.env.GITHUB_ACTIONS === "true") {
      await createGithubReleaseEntry(tag, notes);
    } else {
      await createGitlabReleaseEntry(tag, notes);
    }
  } catch (error) {
    console.warn(
      `⚠️ could not create the release entry for ${tag}: ${error}\n` +
        "the release itself is done (commit, tag and changelog are pushed) — " +
        "create the entry by hand if you need it",
    );
  }
};
