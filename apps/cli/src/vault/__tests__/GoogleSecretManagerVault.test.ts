import type { Config } from "@catladder/pipeline";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IO } from "../../core/types";
import {
  GoogleSecretManagerVault,
  resolveGsmProject,
} from "../GoogleSecretManagerVault";

const { runGcloud, runGcloudJson } = vi.hoisted(() => ({
  runGcloud: vi.fn(),
  runGcloudJson: vi.fn(),
}));
vi.mock("../gcloud", () => ({ runGcloud, runGcloudJson }));

const io = { log: vi.fn() } as unknown as IO;
const config = {
  customerName: "pan",
  appName: "app",
  components: {},
} as unknown as Config;

const cloudRun = (projectId: string) => ({
  deploy: { type: "google-cloudrun", projectId },
});
const configWithProjects = (...ids: string[]): Config =>
  ({
    customerName: "pan",
    appName: "app",
    components: Object.fromEntries(
      ids.map((id, i) => [
        `c${i}`,
        { build: { type: "node" }, ...cloudRun(id) },
      ]),
    ),
  }) as unknown as Config;

const vault = () => new GoogleSecretManagerVault(config, { project: "proj" });

beforeEach(() => {
  vi.resetAllMocks();
});

describe("project resolution", () => {
  it("prefers the explicit project", () => {
    expect(resolveGsmProject(configWithProjects("a"), { project: "x" })).toBe(
      "x",
    );
  });
  it("uses the single cloudrun project", () => {
    expect(resolveGsmProject(configWithProjects("a", "a"), {})).toBe("a");
  });
  it("fails without cloudrun deploys", () => {
    expect(() => resolveGsmProject(config, {})).toThrow(
      /secrets\.vault\.project/,
    );
  });
  it("fails when ambiguous", () => {
    expect(() => resolveGsmProject(configWithProjects("a", "b"), {})).toThrow(
      /several GCP projects/,
    );
  });
});

describe("id", () => {
  it("changes with project and prefix", () => {
    const id = (o: object) => new GoogleSecretManagerVault(config, o).id;
    expect(id({ project: "p" })).toBe("gsm:p:catladder");
    expect(id({ project: "q" })).not.toBe(id({ project: "p" }));
    expect(id({ project: "p", prefix: "x" })).toBe("gsm:p:x");
  });
});

describe("readAllSecrets", () => {
  it("reads values and round-trips '-' in env and component", async () => {
    runGcloudJson.mockResolvedValue([
      {
        name: "projects/1/secrets/catladder-pan-app-review-pr-my-www-API_KEY",
        labels: {
          "catladder-env": "review-pr",
          "catladder-component": "my-www",
          "catladder-app": "app",
        },
      },
      {
        name: "projects/1/secrets/other-thing",
        labels: { "catladder-app": "app" },
      },
    ]);
    runGcloud.mockResolvedValue("sesame");

    expect(await vault().readAllSecrets(io)).toEqual({
      // raw names sanitize '-' to '_', the secret id keeps it
      CL_review_pr_my_www_API_KEY: "sesame",
    });
    expect(runGcloud.mock.calls[0][0]).toContain(
      "--secret=catladder-pan-app-review-pr-my-www-API_KEY",
    );
  });

  it("skips secrets without an enabled version", async () => {
    runGcloudJson.mockResolvedValue([
      {
        name: "projects/1/secrets/catladder-pan-app-dev-www-A",
        labels: { "catladder-env": "dev", "catladder-component": "www" },
      },
    ]);
    runGcloud.mockRejectedValue(new Error("FAILED_PRECONDITION: disabled"));
    expect(await vault().readAllSecrets(io)).toEqual({});
  });

  it("surfaces auth failures", async () => {
    runGcloudJson.mockRejectedValue(new Error("run `gcloud auth login`"));
    await expect(vault().readAllSecrets(io)).rejects.toThrow(/auth login/);
  });
});

describe("writeSecrets", () => {
  it("creates missing secrets with labels and adds a version via stdin", async () => {
    runGcloud.mockImplementation(async (args: string[]) => {
      if (args[1] === "describe") throw new Error("NOT_FOUND: not found");
      return "";
    });
    await vault().writeSecrets(io, "dev", "www", { A: "v", B: { x: 1 } });

    const calls = runGcloud.mock.calls;
    const create = calls.find((c) => c[0][1] === "create")![0];
    expect(create).toContain(
      "--labels=catladder-env=dev,catladder-component=www,catladder-app=app",
    );
    const adds = calls.filter((c) => c[0][1] === "versions");
    expect(adds.map((c) => c[1])).toEqual(["v", '{"x":1}']);
    for (const [args] of adds) expect(args).toContain("--data-file=-");
    expect(calls.some((c) => c[0].includes("destroy"))).toBe(false);
  });

  it("does not recreate existing secrets", async () => {
    runGcloud.mockResolvedValue("");
    await vault().writeSecrets(io, "dev", "www", { A: "v" }, { backup: false });
    expect(runGcloud.mock.calls.some((c) => c[0][1] === "create")).toBe(false);
  });

  it("rejects invalid ids before calling gcloud", async () => {
    await expect(
      vault().writeSecrets(io, "dev", "www", { "bad key": "v" }),
    ).rejects.toThrow(/not a valid Secret Manager id/);
    expect(runGcloud).not.toHaveBeenCalled();
  });

  it("rejects payloads over 64 KiB", async () => {
    await expect(
      vault().writeSecrets(io, "dev", "www", { A: "x".repeat(65537) }),
    ).rejects.toThrow(/64 KiB/);
    expect(runGcloud).not.toHaveBeenCalled();
  });

  it("surfaces auth failures", async () => {
    runGcloud.mockRejectedValue(new Error("gcloud auth login"));
    await expect(
      vault().writeSecrets(io, "dev", "www", { A: "v" }),
    ).rejects.toThrow(/auth login/);
  });
});
