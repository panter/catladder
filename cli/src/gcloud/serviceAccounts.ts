import type { ComponentContext } from "@catladder/pipeline";

import { exec } from "child-process-promise";
import { createHmac } from "crypto";
import type { CommandInstance } from "vorpal";
import { upsertAllVariables } from "../utils/gitlab";

export const accountExists = async (fullIdentifier: string) => {
  try {
    await exec(`gcloud iam service-accounts describe ${fullIdentifier}`);
    return true;
  } catch {
    return false;
  }
};

type ServiceAccount = {
  projectId: string;
  name: string;
  displayName: string;
  roles: string[];
  description: string;
};
const upsertGcloudServiceAccount = async (
  context: ComponentContext,
  account: ServiceAccount,
): Promise<string> => {
  const { projectId, name, displayName, roles, description } = account;

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

  const fullDisplayName = `${context.fullConfig.customerName}-${context.fullConfig.appName} ${context.env}:${context.name} | ${displayName}`;

  const fullIdentifier = `${fullName}@${projectId}.iam.gserviceaccount.com`;

  const existing = await accountExists(fullIdentifier);

  if (!existing) {
    await exec(
      `gcloud iam service-accounts create ${fullName} --display-name="${fullDisplayName}" --project="${projectId}"  --description="${description}"`,
    );
  }
  const memberName = `serviceAccount:${fullIdentifier}`;
  for (const role of roles) {
    await exec(
      `gcloud projects add-iam-policy-binding ${projectId} --member=${memberName} --role=${role} --condition=None`,
    );
  }

  // create key

  // delete first all keys
  const keys = await exec(
    `gcloud iam service-accounts keys list --iam-account=${fullIdentifier} --managed-by=user --format=json`,
  ).then((o) => JSON.parse(o.stdout));

  for (const key of keys) {
    await exec(
      `gcloud iam service-accounts keys delete ${key.name} --quiet --iam-account=${fullIdentifier}`,
    );
  }

  return await exec(
    // on some platforms /dev/stdout is not available without the pipe
    `gcloud iam service-accounts keys create /dev/stdout --iam-account=${fullIdentifier} | cat`,
  ).then((o) => o.stdout);
};

export const upsertGcloudServiceAccountAndSaveSecret = async (
  instance: CommandInstance,
  context: ComponentContext,
  account: ServiceAccount,
  secretName: string,
): Promise<void> => {
  instance.log("upserting service account " + account.name + "...");
  const key = await upsertGcloudServiceAccount(context, account);

  await upsertAllVariables(
    instance,
    {
      [secretName]: key,
    },
    context.env,
    context.name,
  );
  instance.log("done!");
};

const hashIfNessecary = (str: string, maxLength: number) =>
  str.length > maxLength ? hash(str, maxLength) : str;

const hash = (str: string, length: number) => {
  return createHmac("sha256", str).digest("hex").substring(0, length);
};
