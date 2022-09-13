import type { Config } from "@catladder/pipeline";
import { getEnvironment } from "@catladder/pipeline";
import { load } from "js-yaml";
import { pick } from "lodash";
import type { CommandInstance } from "vorpal";
import { upsertAllVariables } from "../../../../utils/gitlab";
import { readPass, trashItem } from "../../../../utils/passwordstore";
import type { LEGACY_ENVS } from "./fromv2";

const getPassPath = (newConfig: Config, env: string) => {
  return `${newConfig.customerName}/${newConfig.appName}/${env}/secrets.yml`;
};

export const migrateSecrets = async (
  vorpal: CommandInstance,
  newConfig: Config,
  oldEnv: typeof LEGACY_ENVS[number]
) => {
  const newEnv = oldEnv === "dev-local" ? "local" : oldEnv;
  const path = getPassPath(newConfig, oldEnv);
  try {
    const yamlstring = await readPass(path);
    const secrets = load(yamlstring);

    Object.keys(newConfig.components).forEach(async (componentName) => {
      const environment = getEnvironment(newConfig, componentName, newEnv);
      await upsertAllVariables(
        vorpal,
        pick(secrets, environment.secretEnvVarKeys),
        newEnv,
        componentName
      );
    });
    await trashItem(path);
  } catch (e) {
    console.warn(`could not migrate secrets for env '${oldEnv}': ${e}`);
  }
};
