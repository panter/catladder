import type { RunnerImageName } from "../runner";
import type { Config } from "../types/config";
import type { ReleaseMethod } from "../types/release";

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
};

export const RELEASE_METHODS: Record<ReleaseMethod, ReleaseMethodDefinition> = {
  "semantic-release": {
    image: "semantic-release",
    script: "semanticRelease",
  },
  changesets: {
    image: "changesets",
    script: "changesetsRelease",
  },
};

export const getReleaseMethod = (config: Config): ReleaseMethodDefinition =>
  RELEASE_METHODS[config.releases?.method ?? "semantic-release"];
