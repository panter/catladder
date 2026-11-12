import type { Config } from "@catladder/pipeline";
import {
  getAllEnvsInAllComponents,
  getEnvConfig,
  getSecretVarName,
  isOfDeployType,
} from "@catladder/pipeline";
import type { IO } from "../core/types";
import { runGcloud, runGcloudJson } from "./gcloud";
import type { SecretsVault, WriteSecretsOptions } from "./types";

const DEFAULT_PREFIX = "catladder";
/** Secret Manager's limit for one secret version payload */
const MAX_PAYLOAD_BYTES = 64 * 1024;
const SECRET_ID_RE = /^[A-Za-z0-9_-]{1,255}$/;

export type GsmVaultConfig = {
  type: "google-secret-manager";
  project?: string;
  prefix?: string;
};

/**
 * the GCP project of the vault: the explicit `project`, otherwise the
 * single projectId shared by all google-cloudrun deploys
 */
export const resolveGsmProject = (
  config: Config,
  vaultConfig: { project?: string },
): string => {
  if (vaultConfig.project) return vaultConfig.project;

  const projectIds = new Set<string>();
  for (const componentName of Object.keys(config.components)) {
    for (const env of getAllEnvsInAllComponents(config)) {
      let deploy;
      try {
        deploy = getEnvConfig(config, componentName, env).deploy;
      } catch {
        continue;
      }
      if (isOfDeployType(deploy, "google-cloudrun") && deploy.projectId) {
        projectIds.add(deploy.projectId);
      }
    }
  }
  if (projectIds.size === 1) return [...projectIds][0];
  throw new Error(
    projectIds.size === 0
      ? "google-secret-manager vault: no google-cloudrun deploy to derive the GCP project from — set secrets.vault.project"
      : `google-secret-manager vault: the google-cloudrun deploys use several GCP projects (${[...projectIds].join(", ")}) — set secrets.vault.project`,
  );
};

/** GCP label rules: lowercase, [a-z0-9_-], at most 63 chars */
const toLabel = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "_")
    .slice(0, 63);

type GsmSecret = { name: string; labels?: Record<string, string> };

export class GoogleSecretManagerVault implements SecretsVault {
  readonly id: string;

  private readonly project: string;
  private readonly prefix: string;

  constructor(
    private readonly config: Config,
    vaultConfig: Omit<GsmVaultConfig, "type"> = {},
  ) {
    this.project = resolveGsmProject(config, vaultConfig);
    this.prefix = vaultConfig.prefix ?? DEFAULT_PREFIX;
    this.id = `gsm:${this.project}:${this.prefix}`;
  }

  private get idPrefix() {
    return `${this.prefix}-${this.config.customerName}-${this.config.appName}-`;
  }

  private secretId(env: string, componentName: string, key: string) {
    const id = `${this.idPrefix}${env}-${componentName}-${key}`;
    if (!SECRET_ID_RE.test(id)) {
      throw new Error(
        `secret id '${id}' is not a valid Secret Manager id ([A-Za-z0-9_-], 1-255 chars) — rename the secret, env or component`,
      );
    }
    return id;
  }

  /**
   * env/component/key out of a secret id. env and component come from
   * the labels (they may contain '-'), the KEY is always taken from
   * the id.
   */
  private parseSecretId(secret: GsmSecret) {
    const id = secret.name.split("/").pop() ?? "";
    if (!id.startsWith(this.idPrefix)) return null;
    const labels = secret.labels ?? {};
    const labelEnv = labels["catladder-env"];
    const labelComponent = labels["catladder-component"];
    if (labelEnv === undefined || labelComponent === undefined) return null;
    const rest = id.slice(this.idPrefix.length);
    const env = rest.slice(0, labelEnv.length);
    if (toLabel(env) !== labelEnv || rest[env.length] !== "-") return null;
    const afterEnv = rest.slice(env.length + 1);
    const componentName = afterEnv.slice(0, labelComponent.length);
    if (
      toLabel(componentName) !== labelComponent ||
      afterEnv[componentName.length] !== "-"
    ) {
      return null;
    }
    const key = afterEnv.slice(componentName.length + 1);
    return key ? { env, componentName, key } : null;
  }

  async readAllSecrets(io: IO | null): Promise<Record<string, string>> {
    const secrets = await runGcloudJson<GsmSecret[]>([
      "secrets",
      "list",
      `--project=${this.project}`,
      `--filter=labels.catladder-app=${toLabel(this.config.appName)}`,
    ]);

    const result: Record<string, string> = {};
    for (const secret of secrets) {
      const parsed = this.parseSecretId(secret);
      if (!parsed) continue;
      const id = secret.name.split("/").pop() as string;
      try {
        result[getSecretVarName(parsed.env, parsed.componentName, parsed.key)] =
          await runGcloud([
            "secrets",
            "versions",
            "access",
            "latest",
            `--secret=${id}`,
            `--project=${this.project}`,
          ]);
      } catch (e) {
        if (
          e instanceof Error &&
          /FAILED_PRECONDITION|NOT_FOUND/.test(e.message)
        ) {
          io?.log(`⚠️ secret ${id} has no enabled version, skipping`);
          continue;
        }
        throw e;
      }
    }
    return result;
  }

  /**
   * upserts per key (describe → create → add version). `options.backup`
   * is a no-op: Secret Manager retains previous versions, and we never
   * destroy or disable them — not even for `backup: false`.
   */
  async writeSecrets(
    io: IO,
    env: string,
    componentName: string,
    secrets: Record<string, unknown>,
    _options?: WriteSecretsOptions,
  ): Promise<void> {
    const entries = Object.entries(secrets).map(([key, value]) => ({
      id: this.secretId(env, componentName, key),
      key,
      payload: typeof value === "string" ? value : JSON.stringify(value),
    }));
    // validate everything before touching anything
    for (const { key, payload } of entries) {
      if (Buffer.byteLength(payload, "utf-8") > MAX_PAYLOAD_BYTES) {
        throw new Error(
          `secret '${key}' exceeds the Secret Manager limit of 64 KiB`,
        );
      }
    }

    for (const { id, payload } of entries) {
      if (!(await this.exists(id))) {
        await runGcloud([
          "secrets",
          "create",
          id,
          `--project=${this.project}`,
          "--replication-policy=automatic",
          `--labels=${[
            ["catladder-env", env],
            ["catladder-component", componentName],
            ["catladder-app", this.config.appName],
          ]
            .map(([k, v]) => `${k}=${toLabel(v)}`)
            .join(",")}`,
        ]);
      }
      await runGcloud(
        [
          "secrets",
          "versions",
          "add",
          id,
          `--project=${this.project}`,
          "--data-file=-",
        ],
        payload,
      );
    }
  }

  private async exists(id: string): Promise<boolean> {
    try {
      await runGcloud(["secrets", "describe", id, `--project=${this.project}`]);
      return true;
    } catch (e) {
      if (e instanceof Error && /NOT_FOUND|not found/i.test(e.message)) {
        return false;
      }
      throw e;
    }
  }
}
