import type { ComponentContext } from "@catladder/pipeline";

import { exec } from "child-process-promise";
import type { IO } from "../core/types";
import { upsertAllVariables } from "../utils/gitlab";
import { getGcloudServiceAccountNames } from "./serviceAccountNames";

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
  const { projectId, displayName, roles, description } = account;

  const { fullName, fullIdentifier } = getGcloudServiceAccountNames(
    context,
    account,
  );

  const fullDisplayName = `${context.fullConfig.customerName}-${context.fullConfig.appName} ${context.env}:${context.name} | ${displayName}`;

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
  instance: IO,
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
