import type { Context } from "@catladder/pipeline";
import { createKubernetesCloudsqlBaseValues } from "@catladder/pipeline";
import { isOfDeployType } from "@catladder/pipeline";
import { spawn } from "child-process-promise";
import { writeFile } from "fs-extra";
import { withFile } from "tmp-promise";
import type Vorpal from "vorpal";
import {
  getEnvVars,
  getGitlabVar,
  getPipelineContextByChoice,
  parseChoice,
} from "../../../../config/getProjectConfig";
import { envAndComponents } from "./utils/autocompletions";

type ProxyInfo = {
  instanceName: string;
  DB_NAME: string;
  DB_PASSWORD: string;
  DB_USER: string;
};
export default async (vorpal: Vorpal) =>
  vorpal
    .command("project-cloud-sql-proxy <envComponent>", "proxy to cloud sql db")
    .autocomplete(await envAndComponents())
    .action(async function ({ envComponent }) {
      const { env, componentName } = parseChoice(envComponent);

      const context = await getPipelineContextByChoice(env, componentName);
      let proxyInfo: ProxyInfo;

      if (env === "review") {
        vorpal.log(
          "⚠️ connection string does not include mr information on review environments"
        );
      }
      if (isOfDeployType(context.componentConfig.deploy, "kubernetes")) {
        proxyInfo = await getProxyInfoForKubernetes(context);
      } else if (
        isOfDeployType(context.componentConfig.deploy, "google-cloudrun")
      ) {
        proxyInfo = await getProxyInfoForCloudRun(context);
      } else {
        throw new Error("unsupported environment");
      }

      // skynet-164509:europe-west6:pvl-cyclomania-review=tcp:5432
      const { DB_PASSWORD, DB_NAME, DB_USER, instanceName } = proxyInfo;
      const { localPort } = await this.prompt({
        type: "number",
        name: "localPort",
        default: "54320",
        message: "Local port: ",
      });

      this.log("");
      this.log(`postgres-PW: ${DB_PASSWORD}`);
      this.log("");
      this.log(
        `POSTGRESQL_URL=postgresql://${DB_USER}:${DB_PASSWORD}@localhost:${localPort}/${DB_NAME}?schema=public`
      );
      this.log("");

      // legacy, some projects have the cloudsqlProxyCredentials in the secrets
      // actually it works without, if the current local shell user has access to the db through google cloud
      const cloudsqlProxyCredentials = await getGitlabVar(
        this,
        env,
        componentName,
        "cloudsqlProxyCredentials"
      );

      await withFile(async ({ path: tmpFilePath }) => {
        if (cloudsqlProxyCredentials) {
          await writeFile(tmpFilePath, cloudsqlProxyCredentials);
        }

        await spawn(
          "cloud_sql_proxy",
          [
            "-instances",
            `${instanceName}=tcp:${localPort}`,
            ...(cloudsqlProxyCredentials
              ? ["-credential_file", tmpFilePath]
              : []),
          ],
          {
            stdio: "inherit",
            shell: true,
          }
        );
      });
    });

const getProxyInfoForKubernetes = async (
  context: Context
): Promise<ProxyInfo> => {
  if (!isOfDeployType(context.componentConfig.deploy, "kubernetes")) {
    throw new Error("unsupported");
  }

  const envVars = await getEnvVars(
    this,
    context.environment.shortName,
    context.componentName
  );
  // bit hacky, would be nicer if we would also declare this through env vars
  const cloudSqlValues = createKubernetesCloudsqlBaseValues(context);

  const DB_PASSWORD = envVars?.DB_PASSWORD || envVars?.POSTGRESQL_PASSWORD;

  const DB_NAME = cloudSqlValues.cloudsql.fullDbName;

  const instanceName = cloudSqlValues.cloudsql.instanceConnectionName;

  return {
    instanceName,
    DB_PASSWORD,
    DB_NAME,
    DB_USER: "postgres",
  };
};

const getProxyInfoForCloudRun = async (
  context: Context
): Promise<ProxyInfo> => {
  if (
    !isOfDeployType(context.componentConfig.deploy, "google-cloudrun") ||
    !context.componentConfig.deploy.cloudSql
  ) {
    throw new Error("unsupported");
  }

  const envVars = await getEnvVars(
    this,
    context.environment.shortName,
    context.componentName
  );

  const DB_PASSWORD = envVars?.DB_PASSWORD;
  const DB_USER = envVars?.DB_USER;

  const DB_NAME = context.environment.envVars.DB_NAME;

  return {
    instanceName:
      context.componentConfig.deploy.cloudSql.instanceConnectionName,
    DB_PASSWORD,
    DB_NAME,
    DB_USER,
  };
};
