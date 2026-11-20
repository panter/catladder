import { describe, expect, it } from "vitest";
import type { Config, GithubRunnerConfig } from "../../../types";
import { GithubBackend } from "../GithubBackend";
import { GithubRunners, githubRunnerJobKey } from "../runners";

const baseConfig = {
  appName: "test-app",
  customerName: "pan",
  pipelines: { github: true },
  components: {
    api: {
      dir: "api",
      build: { type: "node" },
      deploy: {
        type: "kubernetes",
        cluster: {
          name: "test",
          region: "europe-west6",
          projectId: "test",
          type: "gcloud",
          domainCanonical: "panter.cloud",
        },
      },
    },
  },
} as unknown as Config;

const workflowsWith = (runner?: GithubRunnerConfig) =>
  new GithubBackend().createWorkflows({
    ...baseConfig,
    pipelines: { github: runner === undefined ? true : { runner } },
  });

/** runs-on of every job, keyed by `<workflow file>#<job id>` */
const runsOn = async (runner?: GithubRunnerConfig) =>
  Object.fromEntries(
    Object.entries(await workflowsWith(runner)).flatMap(([file, workflow]) =>
      Object.entries(workflow.jobs).map(([id, job]) => [
        `${file}#${id}`,
        job["runs-on"],
      ]),
    ),
  );

const isHousekeeping = (key: string) => !key.split("#")[1].startsWith("api-");

describe("githubRunnerJobKey", () => {
  it.each([
    ["🧪 test", "test"],
    ["🛑 Stop ⚠️", "stop"],
    ["🚀 Deploy", "deploy"],
    ["🔨 app", "app"],
    ["my  custom job", "my custom job"],
  ])("%j → %j", (name, key) => {
    expect(githubRunnerJobKey(name)).toBe(key);
  });
});

describe("GithubRunners", () => {
  it("defaults to ubuntu-latest everywhere", () => {
    const runners = new GithubRunners(undefined);
    expect(runners.forJob("api", "dev", "🧪 test")).toBe("ubuntu-latest");
    expect(runners.light).toBe("ubuntu-latest");
  });

  it("uses a literal label for all jobs", () => {
    const runners = new GithubRunners("my-runner");
    expect(runners.forJob("api", "dev", "🧪 test")).toBe("my-runner");
    expect(runners.light).toBe("my-runner");
  });

  it.each<[GithubRunnerConfig, string, string]>([
    [
      { provider: "blacksmith" },
      "blacksmith-2vcpu-ubuntu-2404",
      "blacksmith-2vcpu-ubuntu-2404",
    ],
    [
      { provider: "blacksmith", vcpu: 8 },
      "blacksmith-8vcpu-ubuntu-2404",
      "blacksmith-2vcpu-ubuntu-2404",
    ],
    [{ provider: "celesto" }, "celesto-memory", "celesto-standard"],
    [{ provider: "celesto", size: "xl" }, "celesto-xl", "celesto-standard"],
  ])("derives provider labels for %j", (config, defaultLabel, lightLabel) => {
    const runners = new GithubRunners(config);
    expect(runners.forJob("api", "dev", "🧪 test")).toBe(defaultLabel);
    expect(runners.light).toBe(lightLabel);
  });

  it("resolves environments over scoped jobs over plain jobs over default", () => {
    const runners = new GithubRunners({
      default: { provider: "celesto" },
      light: "light-runner",
      jobs: {
        test: { provider: "celesto", size: "large" },
        "web / test": { provider: "celesto", size: "xl" },
        "🔨 docker": "docker-runner",
      },
      environments: { prod: "ubuntu-latest" },
    });
    expect(runners.forJob("api", "dev", "🧪 test")).toBe("celesto-large");
    expect(runners.forJob("web", "dev", "🧪 test")).toBe("celesto-xl");
    expect(runners.forJob("web", "dev", "🔨 docker")).toBe("docker-runner");
    expect(runners.forJob("api", "dev", "👮 lint")).toBe("celesto-memory");
    expect(runners.forJob("web", "prod", "🧪 test")).toBe("ubuntu-latest");
    expect(runners.light).toBe("light-runner");
  });

  it.each<[unknown, string]>([
    ["", "pipelines.github.runner must be a non-empty runner label"],
    [{ provider: "blacksmith", vcpu: 3 }, "pipelines.github.runner.vcpu"],
    [{ provider: "celesto", size: "huge" }, "pipelines.github.runner.size"],
    [{ provider: "depot" }, "pipelines.github.runner.provider"],
    [{ default: 1 }, "pipelines.github.runner.default"],
    [{ light: "" }, "pipelines.github.runner.light"],
    [{ jobs: { test: "" } }, 'pipelines.github.runner.jobs["test"]'],
    [
      { environments: { prod: { provider: "celesto", size: "x" } } },
      "pipelines.github.runner.environments.prod.size",
    ],
  ])("rejects %j", (config, message) => {
    expect(() => new GithubRunners(config as GithubRunnerConfig)).toThrow(
      message,
    );
  });
});

describe("github runner config in generated workflows", () => {
  it("keeps every job on ubuntu-latest without config", async () => {
    const jobs = await runsOn();
    expect(Object.keys(jobs).length).toBeGreaterThan(5);
    expect(new Set(Object.values(jobs))).toEqual(new Set(["ubuntu-latest"]));
  });

  it("only changes runs-on", async () => {
    const plain = await workflowsWith();
    const configured = await workflowsWith({ provider: "celesto" });
    const stripRunsOn = (workflows: typeof plain) =>
      JSON.parse(
        JSON.stringify(workflows, (key, value) =>
          key === "runs-on" ? undefined : value,
        ),
      );
    expect(stripRunsOn(configured)).toEqual(stripRunsOn(plain));
  });

  it("puts component jobs on default/per-job runners and housekeeping on light", async () => {
    const jobs = await runsOn({
      default: { provider: "blacksmith", vcpu: 4 },
      jobs: { test: { provider: "blacksmith", vcpu: 8 } },
    });
    const housekeeping = Object.entries(jobs).filter(([key]) =>
      isHousekeeping(key),
    );
    const componentJobs = Object.entries(jobs).filter(
      ([key]) => !isHousekeeping(key),
    );
    expect(housekeeping.length).toBeGreaterThan(0);
    for (const [, label] of housekeeping) {
      expect(label).toBe("blacksmith-2vcpu-ubuntu-2404");
    }
    for (const [key, label] of componentJobs) {
      expect(label).toBe(
        /^api-test-/.test(key.split("#")[1])
          ? "blacksmith-8vcpu-ubuntu-2404"
          : "blacksmith-4vcpu-ubuntu-2404",
      );
    }
    expect(componentJobs.some(([key]) => /#api-test-/.test(key))).toBe(true);
  });

  it("keeps an environment on its own runner", async () => {
    const jobs = await runsOn({
      default: { provider: "celesto" },
      environments: { prod: "ubuntu-latest" },
    });
    const prodJobs = Object.entries(jobs).filter(([key]) =>
      key.endsWith("-prod"),
    );
    expect(prodJobs.length).toBeGreaterThan(0);
    for (const [, label] of prodJobs) {
      expect(label).toBe("ubuntu-latest");
    }
    expect(jobs["catladder-review.yml#api-test-review"]).toBe("celesto-memory");
  });
});
