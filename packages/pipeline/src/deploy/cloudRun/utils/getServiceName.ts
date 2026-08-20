import type { StringOrBashExpression } from "@catladder/bash";
import { joinBashExpressions } from "@catladder/bash";
import type { DeployConfigCloudRun } from "../..";
import type { BuildConfig } from "../../../build/types";
import { readGcloudProjectNumber } from "../../../store";
import type { Config } from "../../../types/config";
import type { ComponentContext } from "../../../types/context";
import type { EnvironmentContext } from "../../../types/environmentContext";

/**
 * cloud run only serves its deterministic url
 * `https://<service>-<projectNumber>.<region>.run.app` while that first dns
 * label stays within the 63 characters a dns label allows — the label holds
 * the service name, the project number and any traffic tag together.
 *
 * Beyond it cloud run silently switches to a legacy url built from a random
 * identifier that nothing can recompute. The url catladder generates would
 * then be a hostname that can never resolve, and everything consuming
 * ROOT_URL/ROOT_URL_INTERNAL (cloud tasks targets, service-to-service
 * calls) fails with a dns error instead of a helpful one — which is why the
 * component part is shortened to stay under the limit rather than left to
 * overflow.
 *
 * https://cloud.google.com/run/docs/triggering/https-request
 */
export const CLOUD_RUN_DNS_SEGMENT_LIMIT = 63;

/**
 * review environments resolve their slug at runtime (`mr<iid>` on gitlab,
 * `pr<number>` on github), so its exact length is unknown while generating.
 * Budget for a six digit number so that service names — and with them the
 * urls of already deployed services — do not start changing years later
 * just because a project's merge request numbers grew a digit.
 */
export const REVIEW_SLUG_LENGTH_BUDGET = "mr123456".length;

/**
 * a service name shortened past this point is no longer recognizable. When
 * even this does not fit, the fixed parts (customer name, app name, env,
 * project number) are what needs to shrink — only the user can do that.
 */
const MIN_COMPONENT_PART_LENGTH = 6;

const quote = (name: string) => `"${name}"`;

/**
 * a trailing dash would end up in the hostname as `...-foo-.run.app`
 */
const shortenTo = (name: string, maxLength: number) =>
  name.slice(0, maxLength).replace(/-+$/, "");

export type CloudRunComponentPartInput = {
  customerName: string;
  appName: string;
  env: string;
  /** whether the env resolves a review slug at runtime */
  isReviewEnv: boolean;
  componentName: string;
  projectNumber: string;
  /**
   * the config's other component names, so that a shortened name colliding
   * with a sibling's is caught while generating instead of at deploy time,
   * where two components would fight over one cloud run service
   */
  otherComponentNames: string[];
};

export type CloudRunComponentPart = {
  /** the component part of the service name, shortened if it had to be */
  value: string;
  /** characters dropped from the component name — 0 when it already fit */
  dropped: number;
  /** dns label length of the resulting url, review slug budget included */
  dnsSegmentLength: number;
};

/**
 * the component-name part of a cloud run service name, shortened just
 * enough to keep the deterministic url resolvable.
 *
 * Only the component part is shortened: the env and review slug parts have
 * to stay intact (they are what makes the name unique per environment), the
 * project number is fixed, and customerName/appName are shared by every
 * service of the project.
 */
export const resolveCloudRunComponentPart = ({
  customerName,
  appName,
  env,
  isReviewEnv,
  componentName,
  projectNumber,
  otherComponentNames,
}: CloudRunComponentPartInput): CloudRunComponentPart => {
  const fixedParts = [
    customerName,
    appName,
    env,
    ...(isReviewEnv ? ["_".repeat(REVIEW_SLUG_LENGTH_BUDGET)] : []),
    projectNumber,
  ];
  // + 1 for the dash that joins the component part to the rest
  const fixedLength = fixedParts.join("-").length + 1;
  const available = CLOUD_RUN_DNS_SEGMENT_LIMIT - fixedLength;

  if (componentName.length <= available) {
    return {
      value: componentName,
      dropped: 0,
      dnsSegmentLength: fixedLength + componentName.length,
    };
  }

  if (available < MIN_COMPONENT_PART_LENGTH) {
    throw new Error(
      `Cannot build a resolvable cloud run url for component ${quote(componentName)} in env ${quote(env)}.\n` +
        `Everything but the component name already takes ${fixedLength} of the ${CLOUD_RUN_DNS_SEGMENT_LIMIT} characters ` +
        `a dns label allows (${fixedParts.join("-")}-<component>), leaving only ${available} for the component name.\n` +
        `Shorten appName (${quote(appName)}) or customerName (${quote(customerName)}) by at least ` +
        `${MIN_COMPONENT_PART_LENGTH - available} character(s).` +
        (isReviewEnv
          ? `\nReview environments also carry a runtime slug, for which ${REVIEW_SLUG_LENGTH_BUDGET} characters are reserved.`
          : ""),
    );
  }

  const value = shortenTo(componentName, available);
  const colliding = otherComponentNames.filter(
    (other) => shortenTo(other, available) === value,
  );
  if (colliding.length > 0) {
    throw new Error(
      `Cloud run service names collide in env ${quote(env)}: ${quote(componentName)} and ` +
        `${colliding.map(quote).join(", ")} all shorten to ${quote(value)}, so they would deploy over each other.\n` +
        `The deterministic cloud run url allows ${CLOUD_RUN_DNS_SEGMENT_LIMIT} characters, which leaves ${available} ` +
        `for the component name here — rename the components so their first ${available} characters differ.`,
    );
  }

  return {
    value,
    dropped: componentName.length - value.length,
    dnsSegmentLength: fixedLength + value.length,
  };
};

/**
 * one note per shortened service name instead of one per generated job:
 * service names are resolved again for every job that references them
 */
const reportedTruncations = new Set<string>();

const reportTruncation = (
  env: string,
  componentName: string,
  { value, dnsSegmentLength }: CloudRunComponentPart,
) => {
  const key = `${env}/${componentName}`;
  if (reportedTruncations.has(key)) {
    return;
  }
  reportedTruncations.add(key);
  console.warn(
    `ℹ️ component "${componentName}" deploys to cloud run as "...-${value}" in env "${env}": ` +
      `the full name would push the url past the ${CLOUD_RUN_DNS_SEGMENT_LIMIT} characters cloud run ` +
      `serves deterministically, so the component part is shortened ` +
      `(${dnsSegmentLength} of ${CLOUD_RUN_DNS_SEGMENT_LIMIT} characters used).`,
  );
};

type ServiceNameInput = {
  fullName: StringOrBashExpression;
  environmentSlugPrefix: StringOrBashExpression;
  componentName: string;
  env: string;
  isReviewEnv: boolean;
  deployConfig: DeployConfigCloudRun | null;
  config: Config;
};

/**
 * the cloud run service name before lowercasing, so that callers keep
 * lowercasing the whole expression exactly like they did before.
 *
 * Returns `fullName` unchanged unless the component part had to be
 * shortened — every project whose url already fits generates byte-identical
 * output.
 *
 * Note that the composition below has to match the one `fullName` is built
 * from in getEnvironmentContext; the tests pin that they agree.
 */
const getRawServiceName = ({
  fullName,
  environmentSlugPrefix,
  componentName,
  env,
  isReviewEnv,
  deployConfig,
  config,
}: ServiceNameInput): StringOrBashExpression => {
  const projectNumber = deployConfig
    ? readGcloudProjectNumber(config, deployConfig.projectId)
    : null;
  if (!projectNumber) {
    // without the project number there is no deterministic url to keep
    // resolvable — generating the url itself fails with a store error that
    // says how to fix it, so don't second-guess the name here
    return fullName;
  }
  const componentPart = resolveCloudRunComponentPart({
    customerName: config.customerName,
    appName: config.appName,
    env,
    isReviewEnv,
    componentName,
    projectNumber,
    otherComponentNames: Object.keys(config.components).filter(
      (name) => name !== componentName,
    ),
  });
  if (componentPart.dropped === 0) {
    return fullName;
  }
  reportTruncation(env, componentName, componentPart);
  return joinBashExpressions(
    [
      config.customerName,
      config.appName,
      environmentSlugPrefix,
      componentPart.value,
    ],
    "-",
  );
};

const fromComponentContext = (context: ComponentContext): ServiceNameInput => {
  const deployConfig = context.deploy?.config;
  return {
    fullName: context.environment.fullName,
    environmentSlugPrefix: context.environment.slugPrefix,
    componentName: context.name,
    env: context.env,
    isReviewEnv: context.environment.instance.type === "review",
    deployConfig:
      deployConfig && deployConfig.type === "google-cloudrun"
        ? deployConfig
        : null,
    config: context.fullConfig,
  };
};

const fromEnvironmentContext = (
  context: EnvironmentContext<BuildConfig, DeployConfigCloudRun>,
): ServiceNameInput => ({
  fullName: context.fullName,
  environmentSlugPrefix: context.environmentSlugPrefix,
  componentName: context.componentName,
  env: context.env,
  isReviewEnv: context.instance.type === "review",
  deployConfig: context.deployConfigRaw || null,
  config: context.fullConfig,
});

/**
 * the cloud run service name as it is passed to `gcloud run` — lowercased,
 * and shortened when the deterministic url would otherwise not fit.
 */
export const getServiceName = (context: ComponentContext) =>
  getRawServiceName(fromComponentContext(context)).toLowerCase();

export const getServiceNameForEnvContext = (
  context: EnvironmentContext<BuildConfig, DeployConfigCloudRun>,
) => getRawServiceName(fromEnvironmentContext(context)).toLowerCase();

/**
 * the service name part of the deterministic url, still to be lowercased
 * together with the rest of the hostname by the caller.
 */
export const getRawServiceNameForEnvContext = (
  context: EnvironmentContext<BuildConfig, DeployConfigCloudRun>,
) => getRawServiceName(fromEnvironmentContext(context));
