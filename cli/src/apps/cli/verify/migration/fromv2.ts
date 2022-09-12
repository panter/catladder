import type {
  BuildConfig,
  ComponentConfig,
  Config,
  DeployConfigKubernetes,
  Env,
} from "@catladder/pipeline";
import {
  existsSync,
  lstatSync,
  readdirSync,
  readFile,
  writeFile,
} from "fs-extra";
import { isEmpty } from "lodash";
import { join } from "path";
import type Vorpal from "vorpal";
import {
  getGitlabCi,
  getGitlabCiFilePath,
} from "../../../../config/getProjectConfig";
import { readYaml } from "../../../../utils/files";
import { syncBitwarden } from "../../../../utils/passwordstore";
import { getGitRoot } from "../../../../utils/projects";
import { writeConfig } from "../../config/writeConfig";
import { migrateSecrets } from "./migrateSecrets";
import type { OldGitlabCiFile } from "./oldGitlabCi";
import { detectBuildConfig, isOldInclude } from "./oldGitlabCi";
export const LEGACY_ENVS = [
  "dev-local",
  "dev",
  "review",
  "stage",
  "prod",
] as const;

const arrayToRecord = (arr: { name: string }[]): Record<string, any> => {
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

const getLegacyMonorepoSubCiFiles = (dir: string) => {
  return readdirSync(dir)
    .filter((file) => lstatSync(file).isDirectory())
    .map((dir) => ({
      dir,
      ci: join(dir, ".gitlab-ci.yml"),
    }))
    .filter(({ ci }) => existsSync(ci));
};

const transformValues = (
  valuesIn: Record<string, any>
): DeployConfigKubernetes["values"] => {
  if (isEmpty(valuesIn)) {
    return undefined;
  }
  delete valuesIn?.application?.host;
  delete valuesIn?.application?.command;

  return {
    ...valuesIn,
    jobs: arrayToRecord(valuesIn?.jobs),
    cronjobs: arrayToRecord(valuesIn?.cronjobs),
  };
};

export const isV2 = async () => {
  const gitlabCi = await getGitlabCi<OldGitlabCiFile>();
  return isOldInclude(gitlabCi);
};
export const migrateV2 = async (vorpal: Vorpal) => {
  const gitlabCi = await getGitlabCi<OldGitlabCiFile>();
  const gitRoot = await getGitRoot();

  const {
    CUSTOMER_NAME,
    APP_NAME,
    COMPONENT_NAME = "web",
    APP_DIR = ".",
    STAGING_ENABLED,
  } = gitlabCi.variables;

  vorpal
    .command("migrate")

    .action(async function () {
      this.log("");
      this.log("⚠️ this project uses legacy catladder (v2)");
      this.log("");
      this.log(
        "😼 I can migrate the project for you. This contains the following steps:"
      );
      this.log("");
      this.log(
        " - migrate the config from values-*.yml to catladder config file"
      );
      this.log(
        " - migrate the secrets from bitwarden to gitlab (this will trash the entries in bitwarden)"
      );
      this.log("");
      this.log(
        "☝ make sure that you checked in your current state in case something goes wrong."
      );
      this.log(
        "☝ secrets in bitwarden are deleted, but can be restored within 30 days."
      );
      this.log("");
      const { shouldContinue } = await this.prompt({
        default: true,
        message: "Migrate project now? 🤔",
        name: "shouldContinue",
        type: "confirm",
      });

      if (shouldContinue) {
        vorpal.log("");
        vorpal.log("");
        vorpal.log("💪😼 ok, let's go...");
        vorpal.log("");
        vorpal.log("");

        const createComponent = async (
          dir: string,
          ciFile: OldGitlabCiFile
        ): Promise<ComponentConfig> => {
          const { env, ...baseValues } =
            (await readYaml(dir + "/values.yml")) ?? {};

          const startCommand = Array.isArray(baseValues?.application?.command)
            ? baseValues?.application?.command.join(" ")
            : baseValues?.application?.command;
          return {
            vars: env ? transformVars(env) : undefined,
            dir: dir,
            build: {
              type: detectBuildConfig(ciFile),
              startCommand: startCommand,
            } as BuildConfig,
            deploy: {
              type: "kubernetes",
              values: transformValues(baseValues),
              cluster: {
                type: "gcloud",
                name: "ch-production",
                projectId: "skynet-swiss",
                region: "europe-west6-a",
                domainCanonical: "panter.swiss",
              },
            },
            env: await LEGACY_ENVS.reduce<Promise<Env>>(
              async (acc, envName) => {
                if (envName === "stage" && !STAGING_ENABLED) {
                  return {
                    ...(await acc),
                    [envName]: false,
                  };
                }
                const newEnvName = envName === "dev-local" ? "local" : envName;

                const envValues =
                  (await readYaml(dir + `/values-${envName}.yml`)) ?? {};
                const { env, ...rest } = envValues;
                const host = rest?.application?.host;
                const values = transformValues(rest);
                return {
                  ...(await acc),
                  [newEnvName]: {
                    host: host,
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
          };
        };
        let components: Record<string, ComponentConfig>;
        if (detectBuildConfig(gitlabCi) === "monorepo") {
          components = await getLegacyMonorepoSubCiFiles(gitRoot).reduce<
            Promise<Record<string, ComponentConfig>>
          >(async (acc, el) => {
            return {
              ...(await acc),
              [el.dir]: await createComponent(el.dir, await readYaml(el.ci)),
            };
          }, Promise.resolve({}));
        } else {
          components = {
            [COMPONENT_NAME]: await createComponent(APP_DIR, gitlabCi),
          };
        }
        // we only have one component
        const config: Config = {
          customerName: CUSTOMER_NAME,
          appName: APP_NAME,
          components,
        };

        const comment =
          "Old migrated config:\n\n" +
          (await readFile(await getGitlabCiFilePath(), {
            encoding: "utf-8",
          }));

        this.log("-------------------");
        this.log("migrate config");
        await writeConfig(this, config, {
          endComment: comment,
        });
        this.log("write gitlab-ci.yml");
        await writeFile(
          await getGitlabCiFilePath(),
          "include: https://git.panter.ch/api/v4/projects/catladder%2Fcatladder/packages/generic/ci-includes/main/gitlab-ci.yml",
          { encoding: "utf-8" }
        );

        this.log("-------------------");
        this.log("migrate secrets");
        await syncBitwarden();
        for (const env of LEGACY_ENVS) {
          if (env === "stage" && !STAGING_ENABLED) return;
          await migrateSecrets(this, config, env);
        }

        this.log("-------------------");

        this.log("done!");
        this.log("");
        this.log("You can remove the values*.yml files now.");

        this.log("-------------------");
      } else {
        this.log(
          "☝ if you want to use catladder in legacy mode, install @panter/catladder globally and invoke catladder-legacy"
        );
      }
    });

  vorpal.exec("migrate");
};
