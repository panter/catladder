import { getGitRemoteHostAndPath } from "../git/gitProjectInformation";

/**
 * the base url of the gitlab instance this project lives on.
 *
 * Never hardcode an instance: catladder is used outside panter, and the
 * host was baked in as https://git.panter.ch in several places, which
 * silently broke every consumer on another gitlab.
 *
 * - in a gitlab CI job, `CI_SERVER_URL` is the authoritative value
 *   (predefined, already includes the scheme)
 * - locally, derive it from the git remote
 *
 * @param remoteName the remote to derive from outside CI (default origin)
 */
export const getGitlabHostUrl = async (remoteName = "origin") => {
  const fromCi = process.env.CI_SERVER_URL;
  if (fromCi) {
    return fromCi.replace(/\/+$/, "");
  }
  const { gitRemoteHost } = await getGitRemoteHostAndPath(remoteName);
  return `https://${gitRemoteHost}`;
};
