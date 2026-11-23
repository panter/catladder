import type { RunnerImageName } from "../runner";
import type { Config } from "../types/config";
import type { ReleaseMethod, ReleaseRequiredStatus } from "../types/release";

/**
 * what a release method contributes to the release jobs. The job shape
 * (stage, rules, gates, token) is identical across methods and stays in
 * the backends; a method only supplies the tooling image and its
 * entrypoint script.
 */
export type ReleaseMethodDefinition = {
  /**
   * the catladder job image carrying the release tooling
   */
  image: RunnerImageName;
  /**
   * the entrypoint script baked into the image (on PATH), used as the
   * job script. Every entrypoint must run the security-audit gate
   * before releasing.
   */
  script: string;
  /**
   * optional MR/PR check script (on the same image): generates an
   * informational check job in merge-request pipelines (e.g. the
   * changeset check reporting what merging would release)
   */
  checkScript?: string;
  /**
   * variables injected into the FORCE release jobs only, letting the
   * method's script implement force semantics (e.g. changesets: release
   * a patch bump even without pending changesets)
   */
  forceReleaseVariables?: Record<string, string>;
};

export const RELEASE_METHODS: Record<ReleaseMethod, ReleaseMethodDefinition> = {
  "semantic-release": {
    image: "semantic-release",
    script: "semanticRelease",
  },
  changesets: {
    image: "changesets",
    script: "changesetsRelease",
    checkScript: "changesetCheck",
    forceReleaseVariables: { CATLADDER_FORCE_RELEASE: "true" },
  },
};

export const getReleaseMethod = (config: Config): ReleaseMethodDefinition =>
  RELEASE_METHODS[config.releases?.method ?? "semantic-release"];

/**
 * env vars that hand `releases.requireStatus` to catci's release queue
 * commands. Keep in sync with cli/src/release/githubQueuedRelease.ts.
 */
export const RELEASE_REQUIRED_STATUS_ENV = "CATLADDER_RELEASE_REQUIRED_STATUS";
export const RELEASE_GATE_WORKFLOW_ENV = "CATLADDER_RELEASE_GATE_WORKFLOW";

/**
 * the validated `releases.requireStatus` (undefined when not set)
 */
export const getReleaseRequiredStatus = (
  config: Config,
): ReleaseRequiredStatus | undefined => {
  const required = config.releases?.requireStatus;
  if (required === undefined) {
    return undefined;
  }
  const path = "releases.requireStatus";
  if (typeof required !== "object" || required === null) {
    throw new Error(`${path} must be { context, workflow }`);
  }
  for (const key of ["context", "workflow"] as const) {
    const value = required[key];
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new Error(
        `${path}.${key} must be a non-empty string, got: ${JSON.stringify(value)}`,
      );
    }
  }
  if (config.releases?.when === "auto") {
    throw new Error(
      `${path} needs releases.when "manual": an automatic release runs at the end of the main workflow, before any later result exists`,
    );
  }
  const gitlabEnabled = config.pipelines
    ? !!config.pipelines.gitlab
    : (config.pipelineType ?? "gitlab") === "gitlab";
  if (gitlabEnabled) {
    throw new Error(
      `${path} is github only — remove it or disable the gitlab pipeline (it would release without the gate there)`,
    );
  }
  return required;
};
