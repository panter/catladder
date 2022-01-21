import { load } from "js-yaml";
import { CommandInstance } from "vorpal";
import { upsertAllVariables } from "../../../../utils/gitlab";
import { readPass, trashItem } from "../../../../utils/passwordstore";
import { LEGACY_ENVS } from "./fromv2";
import { OldGitlabCiFile } from "./oldGitlabCi";

const getPassPath = (gitlabCi: OldGitlabCiFile, env: string) => {
  return `${gitlabCi.variables.CUSTOMER_NAME}/${gitlabCi.variables.APP_NAME}/${env}/secrets.yml`;
};

export const migrateSecrets = async (
  vorpal: CommandInstance,
  gitlabCi: OldGitlabCiFile,
  env: typeof LEGACY_ENVS[number]
) => {
  const path = getPassPath(gitlabCi, env);
  try {
    const yamlstring = await readPass(path);
    const secrets = load(yamlstring);

    await upsertAllVariables(
      vorpal,
      secrets,
      env === "dev-local" ? "local" : env,
      gitlabCi.variables.COMPONENT_NAME
    );
    await trashItem(path);
  } catch (e) {
    console.warn(`could not migrate secrets for env '${env}': ${e}`);
  }
};
