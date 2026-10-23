import type { ComponentContext } from "@catladder/pipeline";
import {
  diffRoleBindings,
  getLocalAccessGcpSecretName,
  getSecretVarName,
  LOCAL_ACCESS_GCP_SA_NAME,
} from "@catladder/pipeline";
import { exec } from "child-process-promise";
import { mkdtemp, readFile, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
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

type IamBinding = {
  role: string;
  members?: string[];
  condition?: { title?: string; expression?: string };
};

/**
 * all unconditional roles bound to `member` in the given iam policy
 * bindings. Conditional bindings are reported separately, see
 * {@link getConditionalRolesOfMemberInBindings}.
 */
export const getRolesOfMemberInBindings = (
  bindings: IamBinding[],
  member: string,
): string[] =>
  bindings
    .filter((binding) => !binding.condition)
    .filter((binding) => binding.members?.includes(member))
    .map((binding) => binding.role)
    .sort();

/**
 * roles bound to `member` under an iam condition. These cannot be
 * removed by role name alone, so they are never touched by `project
 * setup` — only reported.
 */
export const getConditionalRolesOfMemberInBindings = (
  bindings: IamBinding[],
  member: string,
): string[] =>
  bindings
    .filter((binding) => binding.condition)
    .filter((binding) => binding.members?.includes(member))
    .map((binding) => binding.role)
    .sort();

/**
 * parses the output of `gcloud iam service-accounts keys create` and
 * makes sure it is a usable service account key
 */
export const parseServiceAccountKey = (
  raw: string,
): { key: string; privateKeyId: string } => {
  let parsed: { private_key_id?: unknown; private_key?: unknown };
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("gcloud did not return a valid service account key");
  }
  if (
    typeof parsed.private_key_id !== "string" ||
    typeof parsed.private_key !== "string"
  ) {
    throw new Error("gcloud did not return a valid service account key");
  }
  return { key: raw, privateKeyId: parsed.private_key_id };
};

const getProjectBindings = async (projectId: string): Promise<IamBinding[]> =>
  JSON.parse(
    (await exec(`gcloud projects get-iam-policy ${projectId} --format=json`))
      .stdout,
  ).bindings ?? [];

export const listUserManagedKeyIds = async (
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
  const bindings = await getProjectBindings(projectId);
  const conditional = getConditionalRolesOfMemberInBindings(bindings, member);
  if (conditional.length > 0) {
    io.log(
      `⚠️ ${fullIdentifier} has conditional bindings (${conditional.join(", ")}) — setup does not touch them, remove them by hand`,
    );
  }
  const { missing, extra } = diffRoleBindings(
    roles,
    getRolesOfMemberInBindings(bindings, member),
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
  // straight from the vault, NOT through the local cache: a stale cache
  // (older than the first setup, or holding an older key) would make us
  // believe the key is gone, delete the valid one and lock out every
  // other machine.
  const stored = (await vaultManager.vault.readAllSecrets(io))[rawName];

  const validKeyIds = await listUserManagedKeyIds(fullIdentifier);
  let storedKeyId: string | undefined;
  try {
    storedKeyId = JSON.parse(stored).private_key_id;
  } catch {
    // no (or unparsable) stored key
  }
  if (storedKeyId && validKeyIds.includes(storedKeyId)) {
    // keep the cache in line with the vault
    await vaultManager.cacheSecrets("local", context.name, {
      [secretName]: stored,
    });
    // at most one key per account: also drop leftovers of a failed run
    // or keys added by hand
    await deleteKeys(
      fullIdentifier,
      validKeyIds.filter((id) => id !== storedKeyId),
    );
    return;
  }

  io.log("creating local access key...");
  // create first: a failed create must not leave the vault empty
  const { key, privateKeyId } = await createServiceAccountKey(fullIdentifier);
  // straight into the vault, NOT through writeSecretsAndMirror: this
  // key is for local use only and must never reach ci variables.
  // A fresh key replaces the old one, a backup would be dead.
  await vaultManager.writeSecrets(
    "local",
    context.name,
    { [secretName]: key },
    io,
    { backup: false },
  );
  // only now drop the keys that are not the new one
  await deleteKeys(
    fullIdentifier,
    validKeyIds.filter((id) => id !== privateKeyId),
  );
};

const deleteKeys = async (fullIdentifier: string, keyIds: string[]) => {
  for (const keyId of keyIds) {
    await exec(
      `gcloud iam service-accounts keys delete ${keyId} --quiet --iam-account=${fullIdentifier}`,
    );
  }
};

const createServiceAccountKey = async (fullIdentifier: string) => {
  // a private temp file (0700 folder) instead of /dev/stdout | cat:
  // the pipe hid gcloud's exit code
  const folder = await mkdtemp(join(tmpdir(), "catladder-local-access-"));
  try {
    const file = join(folder, "key.json");
    await exec(
      `gcloud iam service-accounts keys create "${file}" --iam-account=${fullIdentifier}`,
    );
    return parseServiceAccountKey(await readFile(file, "utf-8"));
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
};
