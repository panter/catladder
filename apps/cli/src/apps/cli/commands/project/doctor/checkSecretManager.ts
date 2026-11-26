import type { Config } from "@catladder/pipeline";
import { getVaultConfig } from "@catladder/pipeline";
import { runGcloud } from "../../../../../vault/gcloud";
import { resolveGsmProject } from "../../../../../vault/GoogleSecretManagerVault";
import type { DoctorReport } from "./DoctorReport";

const API = "secretmanager.googleapis.com";

/**
 * google-secret-manager vault: the API must be enabled in the vault's
 * project and the current gcloud account must be able to list secrets.
 * Silent for every other vault.
 */
export const checkSecretManager = async (
  report: DoctorReport,
  config: Config,
  gcloud: (args: string[]) => Promise<string> = runGcloud,
) => {
  const vaultConfig = getVaultConfig(config);
  if (vaultConfig.type !== "google-secret-manager") return;

  report.section("google secret manager vault");

  let project: string;
  try {
    project = resolveGsmProject(config, vaultConfig);
  } catch (e) {
    report.fail(e.message, "set `secrets.vault.project` in catladder.ts");
    return;
  }

  let enabled = false;
  try {
    const out = await gcloud([
      "services",
      "list",
      "--enabled",
      `--project=${project}`,
      `--filter=name:${API}`,
      "--format=value(name)",
    ]);
    enabled = out.includes(API);
  } catch (e) {
    report.fail(
      `could not check whether ${API} is enabled in ${project}: ${e.message}`,
      "run: gcloud auth login",
    );
    return;
  }
  if (enabled) {
    report.ok(`${API} is enabled in ${project}`);
  } else {
    report.fail(
      `${API} is not enabled in ${project}`,
      "run: catladder project setup",
    );
    return;
  }

  try {
    await gcloud([
      "secrets",
      "list",
      `--project=${project}`,
      "--limit=1",
      "--format=value(name)",
    ]);
    report.ok(`secrets in ${project} are accessible`);
  } catch (e) {
    report.fail(
      `access to secrets in ${project} denied: ${e.message}`,
      "run: gcloud auth login; reading needs roles/secretmanager.secretAccessor (plus a way to list secrets), writing roles/secretmanager.admin",
    );
  }
};
