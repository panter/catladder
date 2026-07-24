import type { DeployConfigBase } from "./base";

export type DeployConfigNpmPackage = {
  /**
   * publishes the component as an npm package. "Deploying" means
   * `npm publish`, with the version and dist-tag derived from the
   * pipeline trigger:
   *
   * - tagged release (`prod`): version `X.Y.Z` from the `vX.Y.Z` git
   *   tag, dist-tag `latest`
   * - main branch (`dev`) and merge requests (`review`): canary version
   *   `0.0.0-<branch-slug>-<sha>`; dist-tag is the branch slug for
   *   `next`/`beta` branches, `canary` otherwise
   *
   * npm packages have no staging: disable the stage environment on the
   * component (`env: { stage: false }`) so tagged releases publish
   * `latest` directly (prod then auto-deploys).
   *
   * The publish authenticates with the `NPM_TOKEN` secret (managed
   * like any other catladder secret).
   */
  type: "npmPackage";

  /**
   * npm access level of the published package
   * @default "public"
   */
  access?: "public" | "restricted";

  /**
   * npm registry to publish to
   * @default "https://registry.npmjs.org/"
   */
  registry?: string;

  /**
   * overrides the derived dist-tag for this environment (see the
   * derivation rules on {@link DeployConfigNpmPackage})
   */
  distTag?: string;
} & DeployConfigBase;
