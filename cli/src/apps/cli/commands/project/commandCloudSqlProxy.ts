import type { ComponentContext } from "@catladder/pipeline";
import {
  createKubernetesCloudsqlBaseValues,
  getDeployConfigType,
  isOfDeployType,
} from "@catladder/pipeline";
import type Vorpal from "vorpal";
import type { CommandInstance } from "vorpal";
import clipboard from "clipboardy";
import {
  getEnvVarsResolved,
  getPipelineContextByChoice,
  parseChoice,
} from "../../../../config/getProjectConfig";
import { envAndComponents } from "./utils/autocompletions";
import {
  ERROR_NOT_INSTALLED,
  startCloudSqlProxyInCurrentShell,
} from "../../../../gcloud/cloudSql/startProxy";
import { logError, logLines, logWarning } from "../../../../utils/log";

type ProxyInfo = {
  instanceName: string;
  DB_NAME: string;
  DB_PASSWORD: string;
  DB_USER: string;
};

const getProxyInfo = (context: ComponentContext) => {
  if (isOfDeployType(context.deploy?.config, "kubernetes")) {
    return getProxyInfoForKubernetes(this, context);
  } else if (isOfDeployType(context.deploy?.config, "google-cloudrun")) {
    return getProxyInfoForCloudRun(this, context);
  }
  throw new Error(`unsupported environment: ${context.deploy?.config?.type}`);
};

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

  const DB_PASSWORD = (
    envVars?.DB_PASSWORD || envVars?.POSTGRESQL_PASSWORD
  )?.toString();

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
    const deployType = getDeployConfigType(context.deploy?.config);
    const errorMessage =
      deployType === "google-cloudrun"
        ? `DeployConfig is missing the cloudSql property`
        : `Unsupported DeployConfig type: ${deployType}`;
    logError(vorpal, errorMessage);
    throw new Error(errorMessage);
  }
  const envVars = await getEnvVarsResolved(vorpal, context.env, context.name);
  return {
    instanceName: context.deploy?.config.cloudSql.instanceConnectionName,
    DB_PASSWORD: envVars?.DB_PASSWORD?.toString(),
    DB_NAME: context.environment.envVars.DB_NAME.toString(),
    DB_USER: envVars?.DB_USER?.toString(),
  };
};

const getDbUrl = (
  { DB_PASSWORD, DB_NAME, DB_USER }: ProxyInfo,
  localPort: string,
  additional: string = "",
) =>
  `DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@localhost:${localPort}/${DB_NAME}${additional}"`;

const getJdbcUrl = (
  { DB_PASSWORD, DB_NAME, DB_USER }: ProxyInfo,
  localPort: string,
) =>
  `DATABASE_JDBC_URL="jdbc:postgresql://localhost:${localPort}/${DB_NAME}?schema=public&user=${DB_USER}&password=${DB_PASSWORD}"`;

export default async (vorpal: Vorpal) =>
  vorpal
    .command("project-cloud-sql-proxy <envComponent>", "proxy to cloud sql db")
    .autocomplete(await envAndComponents())
    .action(async function ({ envComponent }) {
      const { env, componentName } = parseChoice(envComponent);
      if (!componentName) {
        logWarning(this, "need componentName");
        return;
      }

      const context = await getPipelineContextByChoice(env, componentName);

      if (env === "review") {
        logWarning(
          this,
          "connection string does not include mr information on review environments",
        );
      }

      const { localPort } = await this.prompt({
        type: "number",
        name: "localPort",
        default: "54320",
        message: "Local port: ",
      });

      const proxyInfo = await getProxyInfo(context);

      /**
       * Env variables for libpq (e.g. psql client)
       * https://www.postgresql.org/docs/current/libpq-envars.html#LIBPQ-ENVARS
       */
      const psqlEnvVars = {
        PGPASSWORD: proxyInfo.DB_PASSWORD,
        PGUSER: proxyInfo.DB_USER,
        PGDATABASE: proxyInfo.DB_NAME,
        PGHOST: "localhost",
        PGPORT: localPort,
      };
      const lipbqEnvVarDeclarations = Object.entries(psqlEnvVars).map(
        ([key, value]) => `${key}="${value}"`,
      );
      const dbUrl = getDbUrl(proxyInfo, localPort);
      const jdbcUrl = getJdbcUrl(proxyInfo, localPort);

      clipboard.writeSync(
        [
          "",
          "## CloudSQL proxy connection .env variables",
          dbUrl,
          jdbcUrl,
          "## DATABASE_URL with schema=public parameter (e. g. Prisma requires this):",
          `# ${getDbUrl(proxyInfo, localPort, `?schema=public`)}`,
          "## Env variables for libpq (e.g. psql client https://www.postgresql.org/docs/current/libpq-envars.html#LIBPQ-ENVARS)",
          ...lipbqEnvVarDeclarations,
          "",
        ].join("\n"),
      );

      logLines(
        this,
        null,
        "Connection strings env variables DATABASE_URL and those for the 'psql' client (copied to your clipboard for .env file):",
        dbUrl,
        jdbcUrl,
        ...lipbqEnvVarDeclarations,
        null,
        "DATABASE_URL with schema=public parameter (e. g. Prisma requires this):",
        getDbUrl(proxyInfo, localPort, `?schema=public`),
        null,
      );

      try {
        await startCloudSqlProxyInCurrentShell({
          instanceName: proxyInfo.instanceName,
          localPort,
        });
      } catch (error) {
        if (!(error instanceof Error)) throw error;
        if (error.message !== ERROR_NOT_INSTALLED) throw error;
        logError(
          this,
          error.message,
          null,
          "Please install the Cloud SQL Auth Proxy from:",
          `https://cloud.google.com/sql/docs/postgres/connect-auth-proxy#install`,
          null,
        );
      }
    });
