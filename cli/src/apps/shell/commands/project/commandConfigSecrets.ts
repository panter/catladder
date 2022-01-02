import { V1Secret } from "@kubernetes/client-node";
import yaml from "js-yaml";
import { difference, mapValues, pick } from "lodash";
import Vorpal from "vorpal";
import { GOOGLE_CLOUD_SQL_PASS_PATH } from "../../../../config/constants";
import k8sApi from "../../../../k8sApi";
import { ISecrets } from "../../../../types/types";
import { logError } from "../../../../utils/log";
import {
  editPass,
  insertPass,
  readPass,
  readPassEnvVars,
  syncBitwarden,
} from "../../../../utils/passwordstore";
import {
  getAllSecretsEnvVarsMapping,
  getPassPath,
  getProjectNamespace,
} from "../../../../utils/projects";
import { delay } from "../../../../utils/promise";
import { envAutocompletion } from "./utils/autocompletions";
import ensureCluster from "./utils/ensureCluster";
import ensureNamespace from "./utils/ensureNamespace";
import { promptForSubAppIfAny } from "./utils/monorepo";

export default (vorpal: Vorpal) => {
  vorpal
    .command(
      "project-config-secrets <env>",
      "setup/update secrets stored in pass"
    )
    .autocomplete(envAutocompletion)
    .action(async function ({ env }) {
      await ensureCluster.call(this);

      const passPath = await getPassPath(env);
      this.log("");
      this.log(`😼 I will now open bitwarden @ '${passPath}'`);
      this.log("");

      const subapp = await promptForSubAppIfAny(this);

      const secretEnvVarsMapping = await getAllSecretsEnvVarsMapping(
        env,
        subapp
      );

      await syncBitwarden();

      // check if exist and fill in details if not
      try {
        await readPass(passPath);
      } catch (e) {
        // does not exist. create it
        await createNewEnvInPass.call(this, env, secretEnvVarsMapping);
      }

      let envConfigInPass: any = null;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        let hasError = false;
        await editPass(passPath);

        try {
          envConfigInPass = await readPassEnvVars(passPath);

          const configuredKeysInPass = Object.keys(envConfigInPass);

          const allSecretEnvKeysInValues = Object.keys(secretEnvVarsMapping);
          const keysNotInValues = difference(
            configuredKeysInPass,
            allSecretEnvKeysInValues
          );

          const keysNotInPass = difference(
            allSecretEnvKeysInValues,
            configuredKeysInPass
          );
          if (keysNotInValues.length > 0) {
            this.log("");
            this.log(
              `☝️  Notice: the following keys are defined in pass, but not in values: ${keysNotInValues.join(
                ", "
              )}`
            );
            this.log(
              `These values are probably from another app that uses the same namespace.`
            );
            this.log("");
          }
          if (keysNotInPass.length > 0) {
            await logError(
              this,
              `the following keys are defined in the values.yaml, but not in pass: ${keysNotInPass.join(
                ", "
              )}`
            );

            hasError = true;
          }
        } catch (e) {
          await logError(this, "failed to parse yaml", e.message);
          hasError = true;
        }

        if (hasError) {
          this.log("");
          this.log("🤦 You miserably failed to provide something useful 💩");
          this.log("");
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
          break;
        }
      }

      if (env !== "env-local") {
        await ensureNamespace.call(this, env);

        this.log(
          "😼 Please be patient while i am doing some complicated stuff... "
        );
        const namespace = await getProjectNamespace(env);

        // secrets is object of [key]: secretName
        const grouped = Object.keys(secretEnvVarsMapping).reduce<{
          [secretName: string]: string[];
        }>((acc, key) => {
          const secretName = secretEnvVarsMapping[key];
          return {
            ...acc,
            [secretName]: [...(acc[secretName] || []), key],
          };
        }, {});

        for (const secretName of Object.keys(grouped)) {
          const valueKeysInGroup = grouped[secretName];
          const valuesFromPassInGroup = pick(envConfigInPass, valueKeysInGroup);

          let existingSecretValues = {};
          try {
            const existingSecretResult = await k8sApi.readNamespacedSecret(
              secretName,
              namespace
            );
            // tslint:disable-next-line:no-console
            if (existingSecretResult && existingSecretResult.body.data) {
              existingSecretValues = existingSecretResult.body.data;
            }
          } catch (e) {
            // ignore
          }
          await createKubernetesSecret.call(
            this,
            namespace,
            secretName,

            valuesFromPassInGroup,
            existingSecretValues
          );
        }
        this.log("");
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
    });
};
async function createKubernetesSecret(
  namespace: string,
  secretName: string,
  stringData: Pick<any, string>,
  existingSecretValues?: Record<string, string>
) {
  const secret = new V1Secret();
  secret.metadata = {
    name: secretName,
  };
  secret.data = existingSecretValues;
  secret.stringData = stringData;
  this.log(`😼 upserting secret '${secretName}' (push it real good!)`);
  try {
    await k8sApi.deleteNamespacedSecret(secretName, namespace, "true");
  } catch (e) {
    // ignore
  }
  try {
    await k8sApi.createNamespacedSecret(namespace, secret);
  } catch (e) {
    logError(this, "error pushing secrets", e.body.message);
  }
}

async function createNewEnvInPass(env: any, secretEnvVarsMapping: ISecrets) {
  const passPath = await getPassPath(env);
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
  if (sourceEnv === noAnswer) {
    await insertPass(
      passPath,
      yaml.safeDump(mapValues(secretEnvVarsMapping, (value, key) => "fillme"))
    );
  } else {
    const sourceEnvPath = await getPassPath(sourceEnv);
    const stdout = await readPass(sourceEnvPath);

    await insertPass(passPath, stdout);
  }
}
