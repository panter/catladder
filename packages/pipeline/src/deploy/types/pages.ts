import type { WithCacheConfig } from "../../build";
import type { JobImageConfig } from "../../customImages/projectImages";
import type { DeployConfigBase } from "./base";

export type DeployConfigPages = {
  /**
   * publishes the component as a static site on gitlab pages.
   * "Deploying" means: run the build script and publish its output
   * directory as the pages artifact.
   *
   * Review environments automatically publish under an `mr-<iid>` path
   * prefix (gitlab parallel deployments), giving every merge request
   * its own site preview. The gitlab environment url points at the
   * published pages url.
   *
   * Not yet supported on the github backend (github pages has no
   * parallel-deployment equivalent for MR previews; a deploy via
   * actions/deploy-pages may come later).
   */
  type: "pages";

  /**
   * the script producing the static site
   */
  script: string[];

  /**
   * the directory the script publishes to, relative to the repo root
   * @default "public"
   */
  publishDir?: string;

  /**
   * whether the script needs the package-manager install (yarn/pnpm,
   * autodetected) to run first
   */
  requiresInstall?: boolean;

  /**
   * @deprecated use {@link requiresInstall} — same behavior (the
   * install always uses the project's detected package manager)
   */
  requiresYarnInstall?: boolean;

  /**
   * image to use
   */
  jobImage?: JobImageConfig;
} & DeployConfigBase &
  WithCacheConfig;
