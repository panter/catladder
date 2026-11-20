/**
 * attaches a file to the github release of a tag (the `releaseAsset`
 * option of the npmPackage deploy): the packed tarball stays
 * installable straight from github even when the registry publish is
 * unavailable.
 */

export type GithubReleaseAssetOptions = {
  /** rest api base url, e.g. https://api.github.com */
  apiUrl: string;
  /** `owner/name` */
  repository: string;
  /** git tag the release belongs to, e.g. `v1.2.3` */
  tag: string;
  token: string;
  /** file name of the asset on the release */
  name: string;
  content: Uint8Array;
  fetch?: typeof fetch;
};

type Release = {
  upload_url: string;
  assets: { id: number; name: string }[];
};

const describeFailure = async (response: Response) =>
  `${response.status} ${(await response.text()).slice(0, 300)}`;

/**
 * uploads the asset and returns its download url. An asset of the same
 * name is replaced, so re-running a release job stays idempotent.
 */
export const uploadGithubReleaseAsset = async (
  options: GithubReleaseAssetOptions,
): Promise<string> => {
  const doFetch = options.fetch ?? fetch;
  const headers = {
    Authorization: `Bearer ${options.token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const repoUrl = `${options.apiUrl.replace(/\/$/, "")}/repos/${options.repository}`;

  const releaseResponse = await doFetch(
    `${repoUrl}/releases/tags/${encodeURIComponent(options.tag)}`,
    { headers },
  );
  if (releaseResponse.status === 404) {
    throw new Error(
      `no github release found for tag ${options.tag} — releaseAsset needs the release to exist before the publish job runs`,
    );
  }
  if (!releaseResponse.ok) {
    throw new Error(
      `could not read the github release for ${options.tag}: ${await describeFailure(releaseResponse)}`,
    );
  }
  const release = (await releaseResponse.json()) as Release;

  const existing = release.assets.find((asset) => asset.name === options.name);
  if (existing) {
    const deleteResponse = await doFetch(
      `${repoUrl}/releases/assets/${existing.id}`,
      { method: "DELETE", headers },
    );
    if (!deleteResponse.ok) {
      throw new Error(
        `could not replace the existing release asset ${options.name}: ${await describeFailure(deleteResponse)}`,
      );
    }
  }

  // upload_url is a uri template: https://uploads…/assets{?name,label}
  const uploadUrl = `${release.upload_url.replace(/\{.*$/, "")}?name=${encodeURIComponent(options.name)}`;
  const uploadResponse = await doFetch(uploadUrl, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/gzip" },
    body: options.content,
  });
  if (!uploadResponse.ok) {
    throw new Error(
      `could not upload the release asset ${options.name}${
        uploadResponse.status === 403
          ? " (the job token needs `contents: write`)"
          : ""
      }: ${await describeFailure(uploadResponse)}`,
    );
  }
  const asset = (await uploadResponse.json()) as {
    browser_download_url: string;
  };
  return asset.browser_download_url;
};
