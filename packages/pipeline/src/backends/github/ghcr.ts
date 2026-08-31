/**
 * the ghcr namespace expressed through the actions context — portable
 * across forks, and what every all-lowercase repository keeps using
 */
export const GHCR_REPOSITORY_EXPRESSION = "ghcr.io/${{ github.repository }}";

/**
 * parses `owner/name` out of a github remote url (ssh or https, with or
 * without the `.git` suffix).
 *
 * Shared with the cli (`apps/cli/src/utils/github.ts`) so the two can't
 * drift apart.
 */
export const parseGithubRepoFromRemoteUrl = (url: string): string | undefined =>
  url.match(/github\.com[:/]([\w.-]+\/[\w.-]+?)(\.git)?\s*$/)?.[1];

/**
 * the ghcr image prefix for an `owner/name` repository.
 *
 * The OCI distribution spec only allows `[a-z0-9]` plus `.`, `_` and `-`
 * separators in a repository name, so a mixed-case owner or repo (very
 * common for org logins: `AcmeCorp`, …) makes the docker client reject
 * every tag before it even reaches the network. Lowercasing is not a
 * workaround: the org `AcmeCorp` owns the namespace `ghcr.io/acmecorp`,
 * so the lowercased path is the correct address.
 *
 * Returns the `${{ github.repository }}` expression when lowercasing
 * would change nothing — it is equivalent for those repositories, and
 * unlike a literal it keeps working in a fork (whose token can only
 * push to the fork's own namespace).
 */
export const toGhcrRegistryImage = (repository: string): string => {
  const lowercased = repository.toLowerCase();
  return lowercased === repository
    ? GHCR_REPOSITORY_EXPRESSION
    : `ghcr.io/${lowercased}`;
};
