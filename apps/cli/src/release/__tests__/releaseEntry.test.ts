import { afterEach, describe, expect, it, vi } from "vitest";
import { createReleaseEntry } from "../releaseEntry";

const gitlabEnv = {
  GITHUB_ACTIONS: undefined,
  GL_TOKEN: "glpat-token",
  CI_API_V4_URL: "https://git.example.com/api/v4",
  CI_PROJECT_ID: "42",
};

const githubEnv = {
  GITHUB_ACTIONS: "true",
  GITHUB_TOKEN: "gh-token",
  GITHUB_REPOSITORY: "panter/catladder",
};

const stubEnv = (env: Record<string, string | undefined>) => {
  Object.entries(env).forEach(([key, value]) => vi.stubEnv(key, value as any));
};

const stubFetch = (response: Partial<Response> = {}) => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 201,
    text: async () => "",
    ...response,
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("createReleaseEntry", () => {
  it("creates the gitlab release for the pushed tag", async () => {
    stubEnv(gitlabEnv);
    const fetchMock = stubFetch();

    await createReleaseEntry("v1.2.0", "- Add the export endpoint");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://git.example.com/api/v4/projects/42/releases");
    expect(init.method).toBe("POST");
    expect(init.headers["PRIVATE-TOKEN"]).toBe("glpat-token");
    expect(JSON.parse(init.body)).toEqual({
      tag_name: "v1.2.0",
      description: "- Add the export endpoint",
    });
  });

  it("creates the github release for the pushed tag", async () => {
    stubEnv(githubEnv);
    const fetchMock = stubFetch();

    await createReleaseEntry("v1.2.0", "- Add the export endpoint");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.github.com/repos/panter/catladder/releases");
    expect(init.headers.authorization).toBe("Bearer gh-token");
    expect(JSON.parse(init.body)).toEqual({
      tag_name: "v1.2.0",
      name: "v1.2.0",
      body: "- Add the export endpoint",
    });
  });

  it("does not throw when the api call fails — the tag is already pushed", async () => {
    stubEnv(gitlabEnv);
    stubFetch({ ok: false, status: 403, text: async () => "forbidden" });

    await expect(
      createReleaseEntry("v1.2.0", "- notes"),
    ).resolves.toBeUndefined();
  });

  it("skips without api context instead of failing the release", async () => {
    stubEnv({ ...gitlabEnv, GL_TOKEN: undefined });
    const fetchMock = stubFetch();

    await createReleaseEntry("v1.2.0", "- notes");

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
