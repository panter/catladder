import type { ComponentContext } from "@catladder/pipeline";
import {
  diffRoleBindings,
  getLocalAccessGcpSecretName,
  getSecretVarName,
  LOCAL_ACCESS_GCP_SA_NAME,
} from "@catladder/pipeline";
import { exec } from "child-process-promise";
import type { IO } from "../core/types";
import { getGcloudServiceAccountNames } from "./serviceAccountNames";
import { accountExists } from "./serviceAccounts";

/**
 * the dedicated read-only service account of a component/env that
 * `project setup` provisions from the `localAccess` declaration.
 * Shared with `project doctor` and catenv.
 */
export const getLocalAccessServiceAccountNames = (
  context: ComponentContext,
  projectId: string,
) =>
  getGcloudServiceAccountNames(context, {
    name: LOCAL_ACCESS_GCP_SA_NAME,
    projectId,
  });

type IamBinding = { role: string; members?: string[] };

/** all roles bound to `member` in the given iam policy bindings */
export const getRolesOfMemberInBindings = (
  bindings: IamBinding[],
  member: string,
): string[] =>
  bindings
    .filter((binding) => binding.members?.includes(member))
    .map((binding) => binding.role)
    .sort();

const getProjectBindings = async (projectId: string): Promise<IamBinding[]> =>
  JSON.parse(
    (await exec(`gcloud projects get-iam-policy ${projectId} --format=json`))
      .stdout,
  ).bindings ?? [];

const listUserManagedKeyIds = async (
  fullIdentifier: string,
): Promise<string[]> => {
  const keys: { name: string }[] = JSON.parse(
    (
      await exec(
        `gcloud iam service-accounts keys list --iam-account=${fullIdentifier} --managed-by=user --format=json`,
      )
    ).stdout,
  );
  return keys.map((key) => key.name.split("/").pop()!);
};

/**
 * makes the account's bindings equal to `roles`: adds missing, removes
 * everything else (the account is dedicated, every other binding is
 * drift). Idempotent — a no-op when nothing differs.
 */
const syncBindings = async (
  io: IO,
  projectId: string,
  fullIdentifier: string,
  roles: string[],
) => {
  const member = `serviceAccount:${fullIdentifier}`;
  const { missing, extra } = diffRoleBindings(
    roles,
    getRolesOfMemberInBindings(await getProjectBindings(projectId), member),
  );
  for (const role of missing) {
    io.log(`  + ${role}`);
    await exec(
      `gcloud projects add-iam-policy-binding ${projectId} --member=${member} --role=${role} --condition=None`,
    );
  }
  for (const role of extra) {
    io.log(`  - ${role}`);
    await exec(
      `gcloud projects remove-iam-policy-binding ${projectId} --member=${member} --role=${role} --condition=None`,
    );
  }
};

/**
 * brings the local access service account of a component/env in line
 * with the declared `roles`:
 *
 * - roles declared: account exists, carries exactly these bindings,
 *   and a key for it is in the secret store (under the `local` env, so
 *   it is never mirrored to ci). The key is only created when the
 *   stored one is missing or no longer valid — re-running is a no-op.
 * - no roles declared: bindings are removed and the account (with its
 *   keys) deleted if it exists.
 */
export const syncLocalAccessServiceAccount = async (
  io: IO,
  context: ComponentContext,
  projectId: string,
  roles: string[],
): Promise<void> => {
  const { fullName, fullIdentifier } = getLocalAccessServiceAccountNames(
    context,
    projectId,
  );
  const exists = await accountExists(fullIdentifier);

  if (roles.length === 0) {
    if (exists) {
      io.log(`local access no longer declared, removing ${fullIdentifier}...`);
      await syncBindings(io, projectId, fullIdentifier, []);
      await exec(
        `gcloud iam service-accounts delete ${fullIdentifier} --quiet --project="${projectId}"`,
      );
    }
    return;
  }

  if (!exists) {
    io.log(`creating local access service account ${fullIdentifier}...`);
    await exec(
      `gcloud iam service-accounts create ${fullName} --display-name="${context.fullConfig.customerName}-${context.fullConfig.appName} ${context.env}:${context.name} | Catladder local access (read-only)" --project="${projectId}" --description="Read-only access for local use (agents, scripts)"`,
    );
  }
  await syncBindings(io, projectId, fullIdentifier, roles);

  const secretName = getLocalAccessGcpSecretName(context.env);
  const vaultManager = await io.getVaultManager();
  const rawName = getSecretVarName("local", context.name, secretName);
  const stored = (await vaultManager.readSecrets([rawName], io))[rawName];

  const validKeyIds = await listUserManagedKeyIds(fullIdentifier);
  let storedKeyId: string | undefined;
  try {
    storedKeyId = JSON.parse(stored).private_key_id;
  } catch {
    // no (or unparsable) stored key
  }
  if (storedKeyId && validKeyIds.includes(storedKeyId)) {
    return;
  }

  io.log("creating local access key...");
  for (const keyId of validKeyIds) {
    await exec(
      `gcloud iam service-accounts keys delete ${keyId} --quiet --iam-account=${fullIdentifier}`,
    );
  }
  const key = (
    await exec(
      // on some platforms /dev/stdout is not available without the pipe
      `gcloud iam service-accounts keys create /dev/stdout --iam-account=${fullIdentifier} | cat`,
    )
  ).stdout;
  // straight into the vault, NOT through writeSecretsAndMirror: this
  // key is for local use only and must never reach ci variables.
  // A fresh key replaces the deleted one, a backup would be dead.
  await vaultManager.writeSecrets(
    "local",
    context.name,
    { [secretName]: key },
    io,
    {
      backup: false,
    },
  );
};
