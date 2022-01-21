import {
  BuildConfig,
  Config,
  DeployConfigKubernetes,
  Env,
} from "@catladder/pipeline";
import { readFile, writeFile } from "fs-extra";
import { isEmpty } from "lodash";
import Vorpal from "vorpal";
import {
  getGitlabCi,
  getGitlabCiFilePath,
} from "../../../../config/getProjectConfig";
import { readYaml } from "../../../../utils/files";
import { getGitRoot } from "../../../../utils/projects";
import { writeConfig } from "../../config/writeConfig";
import { detectBuildConfig, OldGitlabCiFile } from "./oldGitlabCi";
const LEGACY_ENVS = ["dev-local", "dev", "review", "stage", "prod"];

const arrayToRecord = (arr: { name: string }[]): Record<string, unknown> => {
  if (!arr) return undefined;
  return Object.fromEntries(arr.map(({ name, ...rest }) => [name, rest]));
};

const transformVars = (rawVars: {
  public: Record<string, any>;
  secret: Record<string, any>;
  fromCommponents: any;
}) => {
  if (rawVars.fromCommponents) {
    console.warn("cant transform legacy fromCommponents");
  }

  return {
    public: rawVars.public,
    secret: rawVars.secret ? Object.keys(rawVars.secret) : undefined,
  };
};

const transformValues = (
  valuesIn: Record<string, any>
): DeployConfigKubernetes["values"] => {
  if (isEmpty(valuesIn)) {
    return undefined;
  }
  delete valuesIn?.application?.hostname;
  delete valuesIn?.application?.command;

  return {
    ...valuesIn,
    jobs: arrayToRecord(valuesIn?.jobs),
    cronjobs: arrayToRecord(valuesIn?.cronjobs),
  };
};
export const migrateV2 = async (vorpal: Vorpal) => {
  const gitlabCi: OldGitlabCiFile = await getGitlabCi();
  const gitRoot = await getGitRoot();

  const { CUSTOMER_NAME, APP_NAME, COMPONENT_NAME, APP_DIR, CLUSTER_NAME } =
    gitlabCi.variables;

  vorpal
    .command("migrate")

    .action(async function () {
      this.log("⚠️ this project uses legacy catladder (v2)");
      this.log("migrate project?");
      const { shouldContinue } = await this.prompt({
        default: true,
        message: "Migrate? 🤔",
        name: "shouldContinue",
        type: "confirm",
      });

      if (shouldContinue) {
        const { env, ...baseValues } =
          (await readYaml(gitRoot + "/values.yml")) ?? {};

        const startCommand = baseValues?.application?.command?.join(" ");

        // we only have one component
        const config: Config = {
          customerName: CUSTOMER_NAME,
          appName: APP_NAME,
          components: {
            [COMPONENT_NAME]: {
              vars: env ? transformVars(env) : undefined,
              dir: APP_DIR ?? ".",
              build: {
                type: detectBuildConfig(gitlabCi),
                startCommand: startCommand,
              } as BuildConfig,
              deploy: {
                type: "kubernetes",
                values: transformValues(baseValues),
                cluster: CLUSTER_NAME,
              },
              env: await LEGACY_ENVS.reduce<Promise<Env>>(
                async (acc, envName) => {
                  const newEnvName =
                    envName === "dev-local" ? "local" : envName;

                  const envValues =
                    (await readYaml(gitRoot + `/values-${envName}.yml`)) ?? {};
                  const { env, ...rest } = envValues;
                  const hostname = rest?.application?.hostname;
                  const values = transformValues(rest);
                  return {
                    ...(await acc),
                    [newEnvName]: {
                      hostname: hostname,
                      vars: env ? transformVars(env) : undefined,
                      deploy: values
                        ? {
                            values: values,
                          }
                        : undefined,
                    },
                  };
                },
                Promise.resolve({})
              ),
            },
          },
        };
        const comment =
          "Old migrated config:\n\n" +
          (await readFile(await getGitlabCiFilePath(), {
            encoding: "utf-8",
          }));
        vorpal.log("write config");
        await writeConfig(this, config, {
          endComment: comment,
        });
        vorpal.log("write gitlab-ci.yml");
        await writeFile(
          await getGitlabCiFilePath(),
          "include: https://git.panter.ch/api/v4/projects/catladder%2Fcatladder/packages/generic/ci-includes/main/gitlab-ci.yml",
          { encoding: "utf-8" }
        );
      }
    });

  vorpal.exec("migrate");
};
