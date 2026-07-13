import {
  getEnabledPipelineTypes,
  getSecretVarName,
  getVaultConfig,
} from "@catladder/pipeline";
import type { Config } from "@catladder/pipeline";
import { stripIndents } from "common-tags";
import { difference } from "lodash-es";
import type { IO } from "../../../../core/types";
import {
  getAllComponentsWithAllEnvsHierarchical,
  getEnvironment,
  getEnvVarsResolved,
  getJobOnlyEnvVarsResolved,
  getProjectComponents,
  getProjectConfig,
  parseChoice,
} from "../../../../config/getProjectConfig";
import {
  getConfiguredGithubRepo,
  pushSecretsToGithub,
} from "../../../../commands/project/commandSecretsSyncGithub";
import { editAsFile } from "../../../../utils/editAsFile";
import { isGhAuthenticated } from "../../../../utils/github";
import { upsertAllVariables } from "../../../../utils/gitlab";
import { delay } from "../../../../utils/promise";

type Vars = {
  [env: string]: {
    [componentName: string]: Record<string, string>;
  };
};
/* for convenience, parse json objects. that makes it easier to edit secrets that are object */
const resolveJson = (v: Vars) =>
  Object.fromEntries(
    Object.entries(v).map(([componentName, envs]) => {
      return [
        componentName,
        Object.fromEntries(
          Object.entries(envs).map(([env, secrets]) => [
            env,
            Object.fromEntries(
              Object.entries(secrets).map(([key, value]) => {
                try {
                  return [key, JSON.parse(value)];
                } catch (e) {
                  return [key, value];
                }
              }),
            ),
          ]),
        ),
      ];
    }),
  );

const getSecretEnvVarKeysToConfigure = async (
  env: string,
  componentName: string,
) => {
  const { secretEnvVarKeys, jobOnlyVars } = await getEnvironment(
    env,
    componentName,
  );
  return [
    ...jobOnlyVars.build.secretEnvVarKeys,
    ...jobOnlyVars.deploy.secretEnvVarKeys,
    ...secretEnvVarKeys,
  ]
    .filter((k) => !k.hidden)
    .map((k) => k.key);
};
const getEnvVarsToEdit = async (
  instance: IO,
  env: string,
  componentName: string,
) => {
  const secretEnvVarKeys = await getSecretEnvVarKeysToConfigure(
    env,
    componentName,
  );

  const normalEnvVars = await getEnvVarsResolved(instance, env, componentName);
  const jobOnlyEnvVars = await getJobOnlyEnvVarsResolved(
    instance,
    env,
    componentName,
  );
  const allEnvVars = {
    ...normalEnvVars,
    ...jobOnlyEnvVars,
  };
  return Object.fromEntries(
    secretEnvVarKeys.map((key) => {
      const value = allEnvVars[key];
      // due to some quirky way to resolve these variables, unset variables have the $CL_ prefix, so we remove thouse here
      const variableIsNotSet =
        value === "$" + getSecretVarName(env, componentName, key);
      return [key, variableIsNotSet ? "🚨 FILL ME" : value];
    }),
  );
};
const doItFor = async (
  instance: IO,
  envAndComponents: {
    [componentName: string]: string[];
  },
) => {
  let valuesToEdit: Vars = Object.fromEntries(
    await Promise.all(
      Object.entries(envAndComponents).map(async ([componentName, envs]) => [
        componentName,
        Object.fromEntries(
          await Promise.all(
            envs.map(async (env) => [
              env,
              await getEnvVarsToEdit(instance, env, componentName),
            ]),
          ),
        ),
      ]),
    ),
  );
  let hasErrors = true;
  while (hasErrors) {
    valuesToEdit = await editAsFile(
      resolveJson(valuesToEdit),
      stripIndents`
        Please fill in all secrets for: 

        ${Object.entries(envAndComponents)
          .map(
            ([componentName, envs]) => `- ${componentName}: ${envs.join(", ")}`,
          )
          .join("\n")}

        `,
    );
    // check for errors
    hasErrors = false;
    for (const [componentName, envs] of Object.entries(envAndComponents)) {
      for (const env of envs) {
        const usedKeys = valuesToEdit[componentName][env]
          ? Object.keys(valuesToEdit[componentName][env])
          : [];
        // check whether newValues have the exact number of keys
        const secretEnvVarKeys = await getSecretEnvVarKeysToConfigure(
          env,
          componentName,
        );

        const extranous = difference(usedKeys, secretEnvVarKeys);
        const missing = difference(secretEnvVarKeys, usedKeys);

        if (extranous.length > 0 || missing.length > 0) {
          instance.log("");
          instance.log(
            `😿 Oh no! There is something wrong with "${componentName}"`,
          );
          instance.log("");
          if (extranous.length > 0) {
            instance.log("these secrets are not declared in the config");
            extranous.forEach((key) => instance.log(key));
            instance.log("");
          }
          if (missing.length > 0) {
            instance.log("these secrets have not been provided:");
            missing.forEach((key) => instance.log(key));
            instance.log("");
          }

          await delay(1000);
          const shouldContinue = await instance.confirm("Try again? 🤔");

          if (!shouldContinue) {
            throw new Error("abort");
          }
          hasErrors = true;
        }
      }
    }
  }
  const config = await getProjectConfig();
  if (!config) {
    throw new Error("no catladder config found");
  }

  instance.log("");
  instance.log("writing all secrets to the vault, please wait...");
  instance.log("");
  for (const [componentName, envs] of Object.entries(envAndComponents)) {
    for (const env of envs) {
      instance.log("writing " + env + ":" + componentName + "...\n");
      await (
        await instance.getVaultManager()
      ).writeSecrets(env, componentName, valuesToEdit[componentName][env]);
      instance.log("");
      instance.log("✅ " + env + ":" + componentName);
      instance.log("--------------------------------\n");
    }
  }

  await mirrorSecretsToCiBackends(
    instance,
    config,
    envAndComponents,
    valuesToEdit,
  );

  instance.log("done! 😻");
  instance.log("");
};

/**
 * the vault is the source of truth; every enabled CI backend receives
 * a mirrored copy of the edited secrets (gitlab variables, github
 * secrets), so all CI systems stay in sync
 */
const mirrorSecretsToCiBackends = async (
  instance: IO,
  config: Config,
  envAndComponents: { [componentName: string]: string[] },
  valuesToEdit: Vars,
) => {
  const enabled = getEnabledPipelineTypes(config);

  // gitlab mirror (unless gitlab is the vault itself, then it is
  // already written)
  if (getVaultConfig(config).type !== "gitlab" && enabled.includes("gitlab")) {
    for (const [componentName, envs] of Object.entries(envAndComponents)) {
      for (const env of envs) {
        await upsertAllVariables(
          instance,
          valuesToEdit[componentName][env],
          env,
          componentName,
        );
      }
    }
    instance.log("✅ mirrored to gitlab");
  }

  if (!enabled.includes("github")) {
    return;
  }
  const kinds = new Map<string, "secret" | "variable">();
  for (const [componentName, envs] of Object.entries(envAndComponents)) {
    for (const env of envs) {
      const { secretEnvVarKeys, jobOnlyVars } = await getEnvironment(
        env,
        componentName,
      );
      [
        ...secretEnvVarKeys,
        ...jobOnlyVars.build.secretEnvVarKeys,
        ...jobOnlyVars.deploy.secretEnvVarKeys,
      ].forEach(({ key, kind }) =>
        kinds.set(getSecretVarName(env, componentName, key), kind ?? "secret"),
      );
    }
  }
  const secrets = Object.entries(envAndComponents).flatMap(
    ([componentName, envs]) =>
      envs.flatMap((env) =>
        Object.entries(valuesToEdit[componentName][env] ?? {}).map(
          ([key, value]) => {
            const name = getSecretVarName(env, componentName, key);
            return {
              name,
              value:
                typeof value === "string" ? value : JSON.stringify(value ?? ""),
              kind: kinds.get(name) ?? ("secret" as const),
            };
          },
        ),
      ),
  );
  if (secrets.length === 0) {
    return;
  }
  if (!(await isGhAuthenticated())) {
    instance.log(
      "⚠️ github pipeline is enabled, but the github cli (gh) is not authenticated — run `project secrets-sync-github` later to mirror the secrets",
    );
    return;
  }
  const repo = await getConfiguredGithubRepo();
  if (!repo) {
    instance.log(
      "⚠️ github pipeline is enabled, but no github repository was found — run `project secrets-sync-github` later to mirror the secrets",
    );
    return;
  }
  instance.log(`mirroring ${secrets.length} secrets to github ('${repo}')...`);
  await pushSecretsToGithub(instance, repo, secrets);
};

export const projectConfigSecrets = async (io: IO, envComponent?: string) => {
  if (!envComponent) {
    const allEnvAndcomponents = await getAllComponentsWithAllEnvsHierarchical();
    await doItFor(io, allEnvAndcomponents);
  } else {
    const { env, componentName } = parseChoice(envComponent);

    // componentName can be null. in this case, iterate over all  components
    if (!componentName) {
      const components = await getProjectComponents();
      await doItFor(io, Object.fromEntries(components.map((c) => [c, [env]])));
    }
    if (componentName) {
      await doItFor(io, {
        [componentName]: [env],
      });
    }
  }
};
