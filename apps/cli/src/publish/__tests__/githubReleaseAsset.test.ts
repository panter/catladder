import { describe, expect, it, vi } from "vitest";
import { uploadGithubReleaseAsset } from "../githubReleaseAsset";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

const baseOptions = {
  apiUrl: "https://api.github.com",
  repository: "panter/catladder",
  tag: "v5.14.0",
  token: "tkn",
  name: "catladder-cli-5.14.0.tgz",
  content: new Uint8Array([1, 2, 3]),
};

const release = (assets: { id: number; name: string }[] = []) => ({
  upload_url:
    "https://uploads.github.com/repos/panter/catladder/releases/1/assets{?name,label}",
  assets,
});

describe("uploadGithubReleaseAsset", () => {
  it("uploads the tarball to the release of the tag", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(json(release()))
      .mockResolvedValueOnce(
        json({ browser_download_url: "https://dl/asset.tgz" }, 201),
      );
    await expect(
      uploadGithubReleaseAsset({ ...baseOptions, fetch }),
    ).resolves.toBe("https://dl/asset.tgz");
    expect(fetch.mock.calls[0][0]).toBe(
      "https://api.github.com/repos/panter/catladder/releases/tags/v5.14.0",
    );
    expect(fetch.mock.calls[1][0]).toBe(
      "https://uploads.github.com/repos/panter/catladder/releases/1/assets?name=catladder-cli-5.14.0.tgz",
    );
    expect(fetch.mock.calls[1][1].method).toBe("POST");
  });

  it("replaces an existing asset of the same name", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        json(release([{ id: 42, name: "catladder-cli-5.14.0.tgz" }])),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(json({ browser_download_url: "u" }, 201));
    await uploadGithubReleaseAsset({ ...baseOptions, fetch });
    expect(fetch.mock.calls[1][0]).toBe(
      "https://api.github.com/repos/panter/catladder/releases/assets/42",
    );
    expect(fetch.mock.calls[1][1].method).toBe("DELETE");
  });

  it("fails clearly when the release does not exist", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(json({}, 404));
    await expect(
      uploadGithubReleaseAsset({ ...baseOptions, fetch }),
    ).rejects.toThrow(/no github release found for tag v5.14.0/);
  });

  it("hints at the missing permission on 403", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(json(release()))
      .mockResolvedValueOnce(json({ message: "forbidden" }, 403));
    await expect(
      uploadGithubReleaseAsset({ ...baseOptions, fetch }),
    ).rejects.toThrow(/contents: write/);
  });
});
