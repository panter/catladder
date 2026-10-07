import type { ComponentContext } from "@catladder/pipeline";

import { exec } from "child-process-promise";
import type { IO } from "../core/types";
import { writeSecretsAndMirror } from "../secrets";
import { retryWithBackoff } from "../utils/promise";
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
  /** roles on cloud storage buckets, keyed by bucket name */
  bucketRoles?: Record<string, string[]>;
  description: string;
};

/**
 * a freshly created service account is not visible to IAM right away:
 * binding a role to it can fail with "Service account ... does not
 * exist" for a few seconds (seen on a first `project setup`)
 */
const isServiceAccountNotYetVisible = (error: unknown) => {
  const message = `${(error as { stderr?: string })?.stderr ?? ""} ${
    (error as Error)?.message ?? ""
  }`;
  return /service account .*does not exist|unknown service account/i.test(
    message,
  );
};

const execIamBinding = (command: string) =>
  retryWithBackoff(() => exec(command), {
    shouldRetry: isServiceAccountNotYetVisible,
    onRetry: (_error, attempt, delayMs) =>
      console.log(
        `service account not visible to IAM yet, retrying in ${delayMs / 1000}s (attempt ${attempt})...`,
      ),
  });

/**
 * creates the service account if missing and binds its project and
 * bucket roles. Returns its email.
 */
const ensureGcloudServiceAccount = async (
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
    await execIamBinding(
      `gcloud projects add-iam-policy-binding ${projectId} --member=${memberName} --role=${role} --condition=None`,
    );
  }
  for (const [bucket, bucketRoles] of Object.entries(
    account.bucketRoles ?? {},
  )) {
    for (const role of bucketRoles) {
      await execIamBinding(
        `gcloud storage buckets add-iam-policy-binding gs://${bucket} --member=${memberName} --role=${role}`,
      );
    }
  }
  return fullIdentifier;
};

/**
 * upserts a service account that is only used as an identity (e.g. the
 * cloud run runtime account) — no key is created
 */
export const upsertGcloudServiceAccountWithoutKey = async (
  instance: IO,
  context: ComponentContext,
  account: ServiceAccount,
): Promise<string> => {
  instance.log("upserting service account " + account.name + "...");
  const email = await ensureGcloudServiceAccount(context, account);
  instance.log("done: " + email);
  return email;
};

const upsertGcloudServiceAccount = async (
  context: ComponentContext,
  account: ServiceAccount,
): Promise<string> => {
  const fullIdentifier = await ensureGcloudServiceAccount(context, account);

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

  // through the vault (and from there to every enabled ci backend) —
  // the key is a secret like any other, the deploy jobs read it under
  // its declared name. Writing it to gitlab directly would break every
  // project that has no gitlab.
  await writeSecretsAndMirror(
    instance,
    [
      {
        env: context.env,
        componentName: context.name,
        secrets: { [secretName]: key },
      },
    ],
    // a fresh key is created on every run, the previous one is deleted
    // at google — a backup copy of it would only be a dead secret
    { backup: false },
  );
  instance.log("done!");
};
