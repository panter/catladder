/* eslint-disable no-constant-condition */
import { getSecretVarName } from "@catladder/pipeline";
import { stripIndents } from "common-tags";
import { difference } from "lodash";
import Vorpal, { CommandInstance } from "vorpal";
import {
  getAllComponentsWithAllEnvsHierarchical,
  getEnvironment,
  getEnvVars,
  getProjectComponents,
  parseChoice,
} from "../../../../config/getProjectConfig";
import { editAsFile } from "../../../../utils/editAsFile";
import { upsertAllVariables } from "../../../../utils/gitlab";
import { delay } from "../../../../utils/promise";
import { allEnvsAndAllComponents } from "./utils/autocompletions";

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
              })
            ),
          ])
        ),
      ];
    })
  );

const getEnvVarsToEdit = async (
  instance: CommandInstance,
  env: string,
  componentName: string
) => {
  const { secretEnvVarKeys } = await getEnvironment(env, componentName);

  const allEnvVars = await getEnvVars(instance, env, componentName);
  return Object.fromEntries(
    secretEnvVarKeys.map((key) => {
      const value = allEnvVars[key];
      // due to some quirky way to resolve these variables, unset variables have the $CL_ prefix, so we remove thouse here
      const variableIsNotSet =
        value === "$" + getSecretVarName(env, componentName, key);
      return [key, variableIsNotSet ? "🚨 FILL ME" : value];
    })
  );
};
const doItFor = async (
  instance: CommandInstance,
  envAndComponents: {
    [componentName: string]: string[];
  }
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
            ])
          )
        ),
      ])
    )
  );
  let hasErrors = true;
  while (hasErrors) {
    valuesToEdit = await editAsFile(
      resolveJson(valuesToEdit),
      stripIndents`
        Please fill in all secrets for: 

        ${Object.entries(envAndComponents)
          .map(
            ([componentName, envs]) => `- ${componentName}: ${envs.join(", ")}`
          )
          .join("\n")}

        `
    );
    // check for errors
    hasErrors = false;
    for (const [componentName, envs] of Object.entries(envAndComponents)) {
      for (const env of envs) {
        const usedKeys = valuesToEdit[componentName][env]
          ? Object.keys(valuesToEdit[componentName][env])
          : [];
        // check whether newValues have the exact number of keys
        const { secretEnvVarKeys } = await getEnvironment(env, componentName);
        const extranous = difference(usedKeys, secretEnvVarKeys);
        const missing = difference(secretEnvVarKeys, usedKeys);

        if (extranous.length > 0 || missing.length > 0) {
          instance.log("");
          instance.log(
            `😿 Oh no! There is something wrong with "${componentName}"`
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
          const { shouldContinue } = await instance.prompt({
            default: true,
            message: "Try again? 🤔",
            name: "shouldContinue",
            type: "confirm",
          });

          if (!shouldContinue) {
            throw new Error("abort");
          }
          hasErrors = true;
        }
      }
    }
  }
  instance.log("upserting all variables, please wait...");
  instance.log("");
  for (const [componentName, envs] of Object.entries(envAndComponents)) {
    for (const env of envs) {
      await upsertAllVariables(
        instance,
        valuesToEdit[componentName][env],
        env,
        componentName
      );
      instance.log("");
      instance.log("✅ " + env + ":" + componentName);
    }
  }
  instance.log("done! 😻");
  instance.log("");
};

export const projectConfigSecrets = async (
  vorpal: CommandInstance,
  envComponent?: string
) => {
  if (!envComponent) {
    const allEnvAndcomponents = await getAllComponentsWithAllEnvsHierarchical();
    await doItFor(vorpal, allEnvAndcomponents);
  } else {
    const { env, componentName } = parseChoice(envComponent);

    // componentName can be null. in this case, iterate over all  components
    if (!componentName) {
      const components = await getProjectComponents();
      await doItFor(
        vorpal,
        Object.fromEntries(components.map((c) => [c, [env]]))
      );
    }
    if (componentName) {
      await doItFor(vorpal, {
        [componentName]: [env],
      });
    }
  }
};

export default async (vorpal: Vorpal) => {
  vorpal
    .command(
      "project-config-secrets [envComponent]",
      "setup/update secrets stored in pass"
    )
    .autocomplete(await allEnvsAndAllComponents())
    .action(async function ({ envComponent }) {
      return await projectConfigSecrets(this, envComponent);
    });
};
