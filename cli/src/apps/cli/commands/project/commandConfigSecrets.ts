/* eslint-disable no-constant-condition */
import { stripIndents } from "common-tags";
import { difference } from "lodash";
import Vorpal, { CommandInstance } from "vorpal";
import { GOOGLE_CLOUD_SQL_PASS_PATH } from "../../../../config/constants";
import {
  getEnvironment,
  getEnvVars,
  getPipelineContextByChoice,
  getProjectComponents,
  parseChoice,
} from "../../../../config/getProjectConfig";
import { editAsFile } from "../../../../utils/editAsFile";
import { upsertAllVariables } from "../../../../utils/gitlab";
import { hasBitwarden, readPass } from "../../../../utils/passwordstore";
import { delay } from "../../../../utils/promise";
import { allEnvsAndAllComponents } from "./utils/autocompletions";

/* for convenience, parse json objects. that makes it easier to edit secrets that are object */
const resolveJson = (v: Record<string, Record<string, string>>) =>
  Object.fromEntries(
    Object.entries(v).map(([c, secrets]) => {
      return [
        c,
        Object.fromEntries(
          Object.entries(secrets).map(([key, value]) => {
            try {
              return [key, JSON.parse(value)];
            } catch (e) {
              return [key, value];
            }
          })
        ),
      ];
    })
  );
const getEnvVarsToEdit = async (env: string, componentName: string) => {
  const { secretEnvVarKeys } = await getEnvironment(env, componentName);

  const allEnvVars = await getEnvVars(this, env, componentName);
  return Object.fromEntries(
    secretEnvVarKeys.map((key) => [key, allEnvVars[key]])
  );
};
const doItFor = async (
  instance: CommandInstance,
  env: string,
  components: string[]
) => {
  let valuesToEdit: Record<string, Record<string, string>> = Object.fromEntries(
    await Promise.all(
      components.map(async (componentName) => [
        componentName,
        await getEnvVarsToEdit(env, componentName),
      ])
    )
  );
  let hasErrors = true;
  while (hasErrors) {
    valuesToEdit = await editAsFile(
      resolveJson(valuesToEdit),
      stripIndents`
        Please fill in all secrets for: ${components.join(", ")}

        `
    );
    // check for errors
    hasErrors = false;
    for (const componentName of components) {
      const usedKeys = valuesToEdit[componentName]
        ? Object.keys(valuesToEdit[componentName])
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

  for (const componentName of components) {
    await upsertAllVariables(
      this,
      valuesToEdit[componentName],
      env,
      componentName
    );

    if (hasBitwarden()) {
      // add cloud sql secret if needed.
      // TODO: this is legacy, in the future we want to have one service account per app

      const context = await getPipelineContextByChoice(env, componentName);
      if (
        context.componentConfig.deploy &&
        context.componentConfig.deploy.values?.cloudsql?.enabled
      ) {
        await upsertAllVariables(
          this,
          {
            cloudsqlProxyCredentials: await readPass(
              GOOGLE_CLOUD_SQL_PASS_PATH
            ),
          },
          env,
          componentName
        );
      }
    }
  }
};

export default async (vorpal: Vorpal) => {
  vorpal
    .command(
      "project-config-secrets <envComponent>",
      "setup/update secrets stored in pass"
    )
    .autocomplete(await allEnvsAndAllComponents())
    .action(async function ({ envComponent }) {
      const { env, componentName } = parseChoice(envComponent);

      // componentName can be null. in this case, iterate over all  components
      if (!componentName) {
        const components = await getProjectComponents();
        await doItFor(this, env, components);
      }
      if (componentName) {
        await doItFor(this, env, [componentName]);
      }

      /*

      
        // adding gcloud sql proxy secret
        const cloudsqlCredentials = await readPass(GOOGLE_CLOUD_SQL_PASS_PATH);
        await createKubernetesSecret.call(
          this,
          namespace,
          "cloudsql-instance-credentials",
          {
            "credentials.json": cloudsqlCredentials,
          }
        );
        this.log("");
        this.log(
          "⚠️  You need to delete/restart pods in order to make them pick up the new config"
        );
        this.log(`you can use project-delete-pods ${env} to do that`);
        this.log("");
        this.log("");
        await delay(1000);
      }
      this.log("");
      this.log("😻 success!!!!!");
      this.log("");
      */
    });
}; /*
async function createNewEnvInPass(env: any, secretEnvVarsMapping: ISecrets) {
  // const passPath = await getPassPath(env);
  this.log(
    "Your selected env is not yet in pass. Do you want to copy it from another env? "
  );
  const noAnswer = "No, I will create a new one from scratch.";
  const { sourceEnv } = await this.prompt({
    type: "list",
    name: "sourceEnv",
    choices: [...(await envAndComponents()).filter((e) => e !== env), noAnswer],
    message: "Do you want to copy an env?",
  });
  // TODO: reimplenent
}
*/
