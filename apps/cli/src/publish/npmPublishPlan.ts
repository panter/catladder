/**
 * pure derivation of what an npmPackage deploy publishes — version and
 * dist-tag from the pipeline trigger. Kept free of process/env access
 * so it is trivially testable; `npmPublishJob` supplies the CI context.
 */

export type NpmPublishContext = {
  /** catladder env type of the deploy job (passed by the generated job) */
  envType: string;
  /** git tag the pipeline runs for, without `refs/` prefix; null on branch/MR pipelines */
  ciTag: string | null;
  /** slugified branch name (the source branch for merge requests) */
  refSlug: string;
  /** short commit sha */
  shortSha: string;
  /** explicit dist-tag from the deploy config, overrides the derivation */
  distTagOverride?: string;
};

export type NpmPublishPlan = {
  version: string;
  distTag: string;
};

/**
 * branches whose canary publishes get their own dist-tag instead of
 * `canary`, so consumers can track them (`yarn add pkg@next`)
 */
export const BRANCH_DIST_TAGS = ["next", "beta"];

export const computeNpmPublishPlan = (
  ctx: NpmPublishContext,
): NpmPublishPlan => {
  if (ctx.envType === "prod" || ctx.envType === "stage") {
    if (!ctx.ciTag) {
      throw new Error(
        `npm publish for env type "${ctx.envType}" expects a tagged-release pipeline, but no git tag is set`,
      );
    }
    return {
      version: ctx.ciTag.replace(/^v/, ""),
      distTag: ctx.distTagOverride ?? "latest",
    };
  }
  return {
    version: `0.0.0-${ctx.refSlug}-${ctx.shortSha}`,
    distTag:
      ctx.distTagOverride ??
      (BRANCH_DIST_TAGS.includes(ctx.refSlug) ? ctx.refSlug : "canary"),
  };
};

/**
 * mirrors gitlab's CI_COMMIT_REF_SLUG derivation (github has no
 * equivalent predefined variable): lowercased, everything except
 * `0-9a-z` replaced with `-`, shortened to 63 bytes, trimmed of
 * leading/trailing `-`
 */
export const slugifyRef = (ref: string): string =>
  ref
    .toLowerCase()
    .replace(/[^0-9a-z]/g, "-")
    .slice(0, 63)
    .replace(/^-+|-+$/g, "");
