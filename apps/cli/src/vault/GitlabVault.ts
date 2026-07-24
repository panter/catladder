import type { IO } from "../core/types";
import { getAllVariables, upsertAllVariables } from "../utils/gitlab";
import type { SecretsVault } from "./types";

/**
 * the legacy (and default) vault: the gitlab project variables double
 * as the secret store
 */
export class GitlabVault implements SecretsVault {
  readonly id = "gitlab";

  async readAllSecrets(io: IO | null): Promise<Record<string, string>> {
    const variables = await getAllVariables(io);
    return Object.fromEntries(variables.map((v) => [v.key, v.value]));
  }

  async writeSecrets(
    io: IO,
    env: string,
    componentName: string,
    secrets: Record<string, unknown>,
  ): Promise<void> {
    await upsertAllVariables(io, secrets, env, componentName);
  }
}
