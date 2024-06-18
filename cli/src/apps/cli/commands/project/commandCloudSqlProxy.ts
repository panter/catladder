import type { ComponentContext } from "@catladder/pipeline";
import {
  createKubernetesCloudsqlBaseValues,
  isOfDeployType,
} from "@catladder/pipeline";
import type Vorpal from "vorpal";
import type { CommandInstance } from "vorpal";
import {
  getEnvVarsResolved,
  getPipelineContextByChoice,
  parseChoice,
} from "../../../../config/getProjectConfig";
import { envAndComponents } from "./utils/autocompletions";
import { startCloudSqlProxyInCurrentShell } from "../../../../gcloud/cloudSql/startProxy";

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
      if (!componentName) {
        this.log("need componentName");
        return;
      }

      const context = await getPipelineContextByChoice(env, componentName);
      let proxyInfo: ProxyInfo;

      if (env === "review") {
        vorpal.log(
          "⚠️ connection string does not include mr information on review environments",
        );
      }
      if (isOfDeployType(context.deploy?.config, "kubernetes")) {
        proxyInfo = await getProxyInfoForKubernetes(this, context);
      } else if (isOfDeployType(context.deploy?.config, "google-cloudrun")) {
        proxyInfo = await getProxyInfoForCloudRun(this, context);
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
      this.log("connection strings:");
      this.log("");
      this.log(
        `DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@localhost:${localPort}/${DB_NAME}?schema=public`,
      );
      this.log("");
      this.log(
        `DATABASE_JDBC_URL=jdbc:postgresql://localhost:${localPort}/${DB_NAME}?schema=public&user=${DB_USER}&password=${DB_PASSWORD}`,
      );
      this.log("");

      await startCloudSqlProxyInCurrentShell({
        instanceName,
        localPort,
      });
    });

const getProxyInfoForKubernetes = async (
  vorpal: CommandInstance,
  context: ComponentContext,
): Promise<ProxyInfo> => {
  if (!isOfDeployType(context.deploy?.config, "kubernetes")) {
    throw new Error("unsupported");
  }

  const envVars = await getEnvVarsResolved(vorpal, context.env, context.name);
  // bit hacky, would be nicer if we would also declare this through env vars
  const cloudSqlValues = createKubernetesCloudsqlBaseValues(context);

  const DB_PASSWORD = envVars?.DB_PASSWORD || envVars?.POSTGRESQL_PASSWORD;

  const DB_NAME = cloudSqlValues.cloudsql.fullDbName.toString();

  const instanceName = cloudSqlValues.cloudsql.instanceConnectionName;

  return {
    instanceName,
    DB_PASSWORD,
    DB_NAME,
    DB_USER: "postgres",
  };
};

const getProxyInfoForCloudRun = async (
  vorpal: CommandInstance,
  context: ComponentContext,
): Promise<ProxyInfo> => {
  if (
    !isOfDeployType(context.deploy?.config, "google-cloudrun") ||
    !context.deploy?.config.cloudSql
  ) {
    throw new Error("unsupported");
  }

  const envVars = await getEnvVarsResolved(vorpal, context.env, context.name);

  const DB_PASSWORD = envVars?.DB_PASSWORD;
  const DB_USER = envVars?.DB_USER;

  const DB_NAME = context.environment.envVars.DB_NAME.toString();

  return {
    instanceName: context.deploy?.config.cloudSql.instanceConnectionName,
    DB_PASSWORD,
    DB_NAME,
    DB_USER,
  };
};
