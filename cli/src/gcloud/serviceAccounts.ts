import type { Context } from "@catladder/pipeline";

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
  context: Context,
  account: ServiceAccount
): Promise<string> => {
  const { projectId, name, displayName, roles, description } = account;

  // name has limit of 30
  const namePrefix = `${name}-`;
  const nameSuffix = `-${context.environment.shortName}-${context.componentName}`;
  const nameMiddleLength = 30 - namePrefix.length - nameSuffix.length;
  const nameMiddle = `${context.fullConfig.customerName}-${context.fullConfig.appName}`;

  const middle = hashIfNessecary(nameMiddle, nameMiddleLength);

  const fullName = `${namePrefix}${middle}${nameSuffix}`;

  const fullDisplayName = `${context.fullConfig.customerName}-${context.fullConfig.appName} ${context.environment.shortName}:${context.componentName} | ${displayName}`;

  const fullIdentifier = `${fullName}@${projectId}.iam.gserviceaccount.com`;

  const existing = await accountExists(fullIdentifier);

  if (!existing) {
    await exec(
      `gcloud iam service-accounts create ${fullName} --display-name="${fullDisplayName}" --project="${projectId}"  --description="${description}"`
    );
  }
  const memberName = `serviceAccount:${fullIdentifier}`;
  for (const role of roles) {
    await exec(
      `gcloud projects add-iam-policy-binding ${projectId} --member=${memberName} --role=${role} `
    );
  }

  // create key

  // delete first all keys
  const keys = await exec(
    `gcloud iam service-accounts keys list --iam-account=${fullIdentifier} --managed-by=user --format=json`
  ).then((o) => JSON.parse(o.stdout));

  for (const key of keys) {
    await exec(
      `gcloud iam service-accounts keys delete ${key.name} --quiet --iam-account=${fullIdentifier}`
    );
  }

  return await exec(
    // on some platforms /dev/stdout is not available without the pipe
    `gcloud iam service-accounts keys create /dev/stdout --iam-account=${fullIdentifier} | cat`
  ).then((o) => o.stdout);
};

export const upsertGcloudServiceAccountAndSaveSecret = async (
  instance: CommandInstance,
  context: Context,
  account: ServiceAccount,
  secretName: string
): Promise<void> => {
  instance.log("upserting service account " + account.name + "...");
  const key = await upsertGcloudServiceAccount(context, account);

  await upsertAllVariables(
    instance,
    {
      [secretName]: key,
    },
    context.environment.shortName,
    context.componentName
  );
  instance.log("done!");
};

const hashIfNessecary = (str: string, maxLength: number) =>
  str.length > maxLength ? hash(str, maxLength) : str;

const hash = (str: string, length: number) => {
  return createHmac("sha256", str).digest("hex").substring(0, length);
};
