import { createHmac } from "crypto";

/**
 * the parts of a component context the naming depends on — structural
 * subset of `ComponentContext` so the naming stays a pure function
 */
export type ServiceAccountNamingContext = {
  env: string;
  name: string;
  fullConfig: { customerName: string; appName: string };
};

/**
 * the deterministic gcloud service account naming used by
 * `project setup`. Extracted so `project doctor` can compute the
 * expected identifier of an account without creating anything.
 *
 * gcloud limits account ids to 30 chars: the customer/app middle part
 * (and, if even that is not enough, the env/component suffix) is
 * replaced by a hash when the full name would not fit.
 */
export const getGcloudServiceAccountNames = (
  context: ServiceAccountNamingContext,
  account: { name: string; projectId: string },
): { fullName: string; fullIdentifier: string } => {
  const { projectId, name } = account;

  // name has limit of 30
  const namePrefix = `${name}`;
  const nameSuffixRaw = `${context.env}-${context.name}`;
  const nameMiddleRaw = `${context.fullConfig.customerName}-${context.fullConfig.appName}`;
  const MAX_LENGTH = 30;
  const NUM_SEPARATORS = 2;

  // we want to first hash middle, then suffix
  // if for middle we have at least 1 char left, its ok, so we don't hash nameSuffix, otherwise we need to hash that as well

  const middleMaxLength =
    MAX_LENGTH - namePrefix.length - nameSuffixRaw.length - NUM_SEPARATORS;

  let nameMiddle: string;
  let nameSuffix: string;
  if (middleMaxLength < 1) {
    nameMiddle = hashIfNessecary(nameMiddleRaw, 1);
    nameSuffix = hashIfNessecary(
      nameSuffixRaw,
      MAX_LENGTH - namePrefix.length - 1 - NUM_SEPARATORS,
    );
  } else {
    nameMiddle = hashIfNessecary(nameMiddleRaw, middleMaxLength);
    nameSuffix = nameSuffixRaw;
  }

  const fullName = `${namePrefix}-${nameMiddle}-${nameSuffix}`;
  const fullIdentifier = `${fullName}@${projectId}.iam.gserviceaccount.com`;

  return { fullName, fullIdentifier };
};

const hashIfNessecary = (str: string, maxLength: number) =>
  str.length > maxLength ? hash(str, maxLength) : str;

const hash = (str: string, length: number) => {
  return createHmac("sha256", str).digest("hex").substring(0, length);
};
