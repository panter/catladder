/* eslint-disable no-constant-condition */
import { difference } from "lodash";
import Vorpal from "vorpal";
import {
  getEnvironmentByChoice,
  getEnvVars,
  parseChoice,
} from "../../../../config/getProjectConfig";
import { ISecrets } from "../../../../types/types";
import { editAsFile } from "../../../../utils/editAsFile";
import { upsertAllVariables } from "../../../../utils/gitlab";
import { delay } from "../../../../utils/promise";
import { envAutocompletion } from "./utils/autocompletions";

export default (vorpal: Vorpal) => {
  vorpal
    .command(
      "project-config-secrets <envComponent>",
      "setup/update secrets stored in pass"
    )
    .autocomplete(envAutocompletion)
    .action(async function ({ envComponent }) {
      const { secretEnvVarKeys } = await getEnvironmentByChoice(envComponent);
      const { env, componentName } = parseChoice(envComponent);
      const allEnvVars = await getEnvVars(this, envComponent);
      let valuesToEdit = Object.fromEntries(
        secretEnvVarKeys.map((key) => [key, allEnvVars[key]])
      );

      while (true) {
        const hasError = false;

        valuesToEdit = await editAsFile(valuesToEdit);
        const usedKeys = valuesToEdit ? Object.keys(valuesToEdit) : [];
        // check whether newValues have the exact number of keys
        const extranous = difference(usedKeys, secretEnvVarKeys);
        const missing = difference(secretEnvVarKeys, usedKeys);

        if (extranous.length > 0 || missing.length > 0) {
          this.log("");
          this.log("😿 Oh no! There is something wrong");
          this.log("");
          if (extranous.length > 0) {
            this.log("these secrets are not declared in the config");
            extranous.forEach((key) => this.log(key));
            this.log("");
          }
          if (missing.length > 0) {
            this.log("these secrets have not been provided:");
            missing.forEach((key) => this.log(key));
            this.log("");
          }

          await delay(1000);
          const { shouldContinue } = await this.prompt({
            default: true,
            message: "Try again? 🤔",
            name: "shouldContinue",
            type: "confirm",
          });

          if (!shouldContinue) {
            throw new Error("abort");
          }
        } else {
          await upsertAllVariables(this, valuesToEdit, env, componentName);

          break;
        }
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
};

async function createNewEnvInPass(env: any, secretEnvVarsMapping: ISecrets) {
  // const passPath = await getPassPath(env);
  this.log(
    "Your selected env is not yet in pass. Do you want to copy it from another env? "
  );
  const noAnswer = "No, I will create a new one from scratch.";
  const { sourceEnv } = await this.prompt({
    type: "list",
    name: "sourceEnv",
    choices: [...envAutocompletion.filter((e) => e !== env), noAnswer],
    message: "Do you want to copy an env?",
  });
  // TODO: reimplenent
}
