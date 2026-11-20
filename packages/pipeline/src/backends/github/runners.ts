import type {
  BlacksmithRunnerVcpu,
  CelestoRunnerSize,
  GithubRunner,
  GithubRunnerConfig,
  GithubRunnerOptions,
} from "../../types/config";

/** github's hosted runner, catladder's default */
export const GITHUB_HOSTED_RUNNER = "ubuntu-latest";

export const BLACKSMITH_RUNNER_VCPUS: readonly BlacksmithRunnerVcpu[] = [
  2, 4, 8, 16, 32,
];

export const CELESTO_RUNNER_SIZES: readonly CelestoRunnerSize[] = [
  "micro",
  "small",
  "standard",
  "memory",
  "large",
  "xl",
];

const BLACKSMITH_DEFAULT_VCPU: BlacksmithRunnerVcpu = 2;
// same shape as github's private-repo ubuntu-latest (2 vCPU / 8 GB)
const CELESTO_DEFAULT_SIZE: CelestoRunnerSize = "memory";
// housekeeping jobs mostly run a short shell script, but some (the
// release job, the image check) install packages or build images —
// 1 vCPU / 2 GB is too tight for that
const CELESTO_LIGHT_SIZE: CelestoRunnerSize = "standard";

const OPTION_PATH = "pipelines.github.runner";

const isRunnerOptions = (
  value: GithubRunnerConfig,
): value is GithubRunnerOptions =>
  typeof value === "object" && value !== null && !("provider" in value);

/** the `runs-on` label of one runner spec */
export const githubRunnerLabel = (
  runner: GithubRunner,
  path: string,
): string => {
  if (typeof runner === "string") {
    if (runner.trim().length === 0) {
      throw new Error(`${path} must be a non-empty runner label`);
    }
    return runner;
  }
  if (typeof runner !== "object" || runner === null) {
    throw new Error(
      `${path} must be a runner label or { provider: "blacksmith" | "celesto" }, got: ${JSON.stringify(runner)}`,
    );
  }
  switch (runner.provider) {
    case "blacksmith": {
      const vcpu = runner.vcpu ?? BLACKSMITH_DEFAULT_VCPU;
      if (!BLACKSMITH_RUNNER_VCPUS.includes(vcpu)) {
        throw new Error(
          `${path}.vcpu must be one of ${BLACKSMITH_RUNNER_VCPUS.join(", ")}, got: ${JSON.stringify(vcpu)}`,
        );
      }
      return `blacksmith-${vcpu}vcpu-ubuntu-2404`;
    }
    case "celesto": {
      const size = runner.size ?? CELESTO_DEFAULT_SIZE;
      if (!CELESTO_RUNNER_SIZES.includes(size)) {
        throw new Error(
          `${path}.size must be one of ${CELESTO_RUNNER_SIZES.join(", ")}, got: ${JSON.stringify(size)}`,
        );
      }
      return `celesto-${size}`;
    }
    default:
      throw new Error(
        `${path}.provider must be "blacksmith" or "celesto", got: ${JSON.stringify((runner as { provider: unknown }).provider)}`,
      );
  }
};

/**
 * the light runner that goes with a default runner: the smallest
 * sensible size of the same provider, or the default itself (a literal
 * label says nothing about its provider's sizes)
 */
const lightRunnerFor = (runner: GithubRunner): GithubRunner => {
  if (typeof runner === "string") return runner;
  switch (runner.provider) {
    case "blacksmith":
      return { provider: "blacksmith", vcpu: 2 };
    case "celesto":
      return { provider: "celesto", size: CELESTO_LIGHT_SIZE };
    default:
      return runner;
  }
};

/**
 * the key a job is matched by in `runner.jobs`: its name without emoji
 * and symbols, lowercased ("🧪 test" → "test", "🛑 Stop ⚠️" → "stop")
 */
export const githubRunnerJobKey = (jobName: string) =>
  jobName
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

/**
 * resolves the `runs-on` label of every generated github job from
 * `pipelines.github.runner`:
 *
 * - component and workspace jobs (build, test, lint, docker, deploy, …)
 *   get their environment's `environments` entry, else the `jobs` entry
 *   matching `<component>/<job>` or `<job>`, else `default`
 * - catladder's housekeeping jobs (image check, ✅ aggregate checks,
 *   review deploy triggers/guards, release jobs) get `light`
 *
 * Without configuration every job keeps github's `ubuntu-latest`.
 */
export class GithubRunners {
  private readonly defaultLabel: string;
  private readonly lightLabel: string;
  private readonly jobLabels: Map<string, string>;
  private readonly envLabels: Map<string, string>;

  constructor(config: GithubRunnerConfig | undefined) {
    const isOptions = config !== undefined && isRunnerOptions(config);
    const options: GithubRunnerOptions =
      config === undefined
        ? {}
        : isRunnerOptions(config)
          ? config
          : { default: config };
    const defaultRunner = options.default ?? GITHUB_HOSTED_RUNNER;
    this.defaultLabel = githubRunnerLabel(
      defaultRunner,
      isOptions ? `${OPTION_PATH}.default` : OPTION_PATH,
    );
    this.lightLabel = githubRunnerLabel(
      options.light ?? lightRunnerFor(defaultRunner),
      `${OPTION_PATH}.light`,
    );
    this.jobLabels = new Map(
      Object.entries(options.jobs ?? {}).map(([key, runner]) => {
        const normalized = key
          .split("/")
          .map((part) => part.trim())
          .join("/");
        const [component, job] = normalized.includes("/")
          ? normalized.split("/", 2)
          : [undefined, normalized];
        const matchKey = component
          ? `${component}/${githubRunnerJobKey(job)}`
          : githubRunnerJobKey(job);
        return [
          matchKey,
          githubRunnerLabel(runner, `${OPTION_PATH}.jobs["${key}"]`),
        ];
      }),
    );
    this.envLabels = new Map(
      Object.entries(options.environments ?? {}).map(([env, runner]) => [
        env,
        githubRunnerLabel(runner, `${OPTION_PATH}.environments.${env}`),
      ]),
    );
  }

  /** the runner of a component or workspace job */
  forJob(contextName: string, env: string, jobName: string): string {
    const key = githubRunnerJobKey(jobName);
    return (
      this.envLabels.get(env) ??
      this.jobLabels.get(`${contextName}/${key}`) ??
      this.jobLabels.get(key) ??
      this.defaultLabel
    );
  }

  /** the runner of catladder's housekeeping jobs */
  get light(): string {
    return this.lightLabel;
  }
}
