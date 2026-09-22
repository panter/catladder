import { readFile, stat } from "fs/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  configureDeployKeyRemote,
  deployKeyRemoteUrl,
  deployKeySshCommand,
  githubDeployKeyRemoteJob,
  pushWithDeployKey,
  RELEASE_DEPLOY_KEY_ENV,
  writeDeployKeyFile,
} from "../githubDeployKey";
import { git, gitWithEnv } from "../releaseGit";

vi.mock("../releaseGit", () => ({
  git: vi.fn(async () => ""),
  gitWithEnv: vi.fn(async () => ""),
}));

const KEY =
  "-----BEGIN OPENSSH PRIVATE KEY-----\nabc\n-----END OPENSSH PRIVATE KEY-----";

describe("github release deploy key", () => {
  const env = { ...process.env };
  beforeEach(() => {
    process.env.GITHUB_REPOSITORY = "FiulAG/nautilus";
    delete process.env.GITHUB_SERVER_URL;
    delete process.env[RELEASE_DEPLOY_KEY_ENV];
    vi.mocked(git).mockClear();
    vi.mocked(gitWithEnv).mockClear();
    vi.mocked(git).mockResolvedValue("");
  });
  afterEach(() => {
    process.env = { ...env };
    vi.restoreAllMocks();
  });

  describe("deployKeyRemoteUrl", () => {
    it("is the ssh url of the repository on github.com", () => {
      expect(deployKeyRemoteUrl()).toBe("git@github.com:FiulAG/nautilus.git");
    });

    it("follows GITHUB_SERVER_URL on an enterprise host", () => {
      process.env.GITHUB_SERVER_URL = "https://github.example.com";
      expect(deployKeyRemoteUrl()).toBe(
        "git@github.example.com:FiulAG/nautilus.git",
      );
    });

    it("fails without the repository", () => {
      delete process.env.GITHUB_REPOSITORY;
      expect(() => deployKeyRemoteUrl()).toThrow(
        "GITHUB_REPOSITORY is not set",
      );
    });
  });

  describe("writeDeployKeyFile", () => {
    it("writes the key with a trailing newline, readable by the owner only", async () => {
      const { keyFile } = await writeDeployKeyFile(KEY);
      expect(await readFile(keyFile, "utf8")).toBe(`${KEY}\n`);
      expect((await stat(keyFile)).mode & 0o777).toBe(0o600);
    });

    it("does not add a second newline", async () => {
      const { keyFile } = await writeDeployKeyFile(`${KEY}\n`);
      expect(await readFile(keyFile, "utf8")).toBe(`${KEY}\n`);
    });
  });

  it("the ssh command uses exactly the deploy key", () => {
    expect(deployKeySshCommand("/tmp/k/id_ed25519")).toBe(
      "ssh -i /tmp/k/id_ed25519 -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new",
    );
  });

  describe("pushWithDeployKey (changesets path)", () => {
    it("pushes the refs atomically to the ssh url with the key", async () => {
      await pushWithDeployKey(KEY, ["HEAD:refs/heads/main", "v1.2.3"]);
      expect(gitWithEnv).toHaveBeenCalledTimes(1);
      const [env, ...args] = vi.mocked(gitWithEnv).mock.calls[0];
      expect(env.GIT_SSH_COMMAND).toMatch(
        /^ssh -i \S+id_ed25519 -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new$/,
      );
      expect(args).toEqual([
        "push",
        "--atomic",
        "git@github.com:FiulAG/nautilus.git",
        "HEAD:refs/heads/main",
        "v1.2.3",
      ]);
    });
  });

  describe("configureDeployKeyRemote (semantic-release path)", () => {
    it("points git's ssh at the key, verifies the key reaches the repo and returns the ssh url", async () => {
      const remote = await configureDeployKeyRemote(KEY);
      expect(remote).toBe("git@github.com:FiulAG/nautilus.git");
      const calls = vi.mocked(git).mock.calls;
      expect(calls[0].slice(0, 2)).toEqual(["config", "core.sshCommand"]);
      expect(calls[0][2]).toMatch(
        /^ssh -i \S+id_ed25519 -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new$/,
      );
      expect(calls[1]).toEqual([
        "ls-remote",
        "--exit-code",
        "git@github.com:FiulAG/nautilus.git",
        "HEAD",
      ]);
    });

    it("fails with the remediation when the key does not reach the repository", async () => {
      vi.mocked(git).mockImplementation(async (...args) => {
        if (args[0] === "ls-remote") {
          throw new Error("git@github.com: Permission denied (publickey).");
        }
        return "";
      });
      await expect(configureDeployKeyRemote(KEY)).rejects.toThrow(
        /cannot reach git@github\.com:FiulAG\/nautilus\.git: .*Permission denied[\s\S]*CATLADDER_RELEASE_KEY secret does not match the 'catladder release' deploy key[\s\S]*catladder project setup/,
      );
    });
  });

  describe("githubDeployKeyRemoteJob (catci release github-deploy-key-remote)", () => {
    it("prints only the ssh url on stdout, the log on stderr", async () => {
      process.env[RELEASE_DEPLOY_KEY_ENV] = KEY;
      const stdout = vi
        .spyOn(process.stdout, "write")
        .mockImplementation(() => true);
      const stderr = vi.spyOn(console, "error").mockImplementation(() => {});
      await githubDeployKeyRemoteJob();
      expect(stdout).toHaveBeenCalledTimes(1);
      expect(stdout).toHaveBeenCalledWith(
        "git@github.com:FiulAG/nautilus.git\n",
      );
      expect(stderr).toHaveBeenCalledWith(
        expect.stringContaining("over ssh with the release deploy key"),
      );
    });

    it("refuses to run without the secret", async () => {
      await expect(githubDeployKeyRemoteJob()).rejects.toThrow(
        `${RELEASE_DEPLOY_KEY_ENV} is not set`,
      );
      expect(git).not.toHaveBeenCalled();
    });
  });
});
