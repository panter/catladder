import type Vorpal from "vorpal";
import { spawnCopyDb } from "../../../../gcloud/cloudSql/copyDb";
import type { CloudSqlBackgroundProxy } from "../../../../gcloud/cloudSql/startProxy";
import { startCloudSqlProxyInBackground } from "../../../../gcloud/cloudSql/startProxy";

export default async (vorpal: Vorpal) =>
  vorpal
    .command(
      "cloud-sql-restore-db",
      "restore a db from one source to another target"
    )
    .action(async function restoreDb() {
      const { sourceInstance } = await this.prompt({
        type: "input",
        name: "sourceInstance",

        message: "Source instance (connection string or 'local')? 🤔 ",
      });

      let sourceProxy: CloudSqlBackgroundProxy;

      let targetProxy: CloudSqlBackgroundProxy;

      let sourcePort: number;
      let targetPort: number;

      if (sourceInstance === "local") {
        const { sourceLocalPort } = await this.prompt({
          type: "number",
          name: "sourceLocalPort",
          default: 5432,

          message: "Local Port for source? 🤔 ",
        });
        sourcePort = sourceLocalPort;
      } else {
        sourcePort = 54399;
        sourceProxy = await startCloudSqlProxyInBackground({
          instanceName: sourceInstance,
          localPort: sourcePort,
        });
      }

      const { sourceUsername } = await this.prompt({
        type: "input",
        name: "sourceUsername",
        default: "postgres",

        message: "Source Username? 🤔 ",
      });

      const { sourcePassword } = await this.prompt({
        type: "input",
        name: "sourcePassword",

        message: "Source Password? 🤔 ",
      });

      const { sourceDbName } = await this.prompt({
        type: "input",
        name: "sourceDbName",

        message: "Source DB name? 🤔 ",
      });

      const { targetInstance } = await this.prompt({
        type: "input",
        name: "targetInstance",

        message: "Target INSTANCE (connection string or 'local')? 🤔  ",
      });

      if (targetInstance === "local") {
        const { targetLocalPort } = await this.prompt({
          type: "number",
          name: "targetLocalPort",
          default: 5432,

          message: "Local Port for target? 🤔 ",
        });
        targetPort = targetLocalPort;
      } else {
        targetPort = 54499;
        targetProxy = await startCloudSqlProxyInBackground({
          instanceName: targetInstance,
          localPort: targetPort,
        });
      }

      const { targetUsername } = await this.prompt({
        type: "input",
        name: "targetUsername",
        default: "postgres",

        message: "Target Username? 🤔 ",
      });
      const { targetPassword } = await this.prompt({
        type: "input",
        name: "targetPassword",

        message: "Target Password? 🤔 ",
      });

      const { targetDbName } = await this.prompt({
        type: "input",
        name: "targetDbName",

        message: "Target DB name? 🤔 ",
      });

      const { shouldContinue } = await this.prompt({
        type: "confirm",
        name: "shouldContinue",
        message: `This will drop ${targetInstance}/${targetDbName} and replace it with ${sourceInstance}/${sourceDbName}. Continue? 🤔 `,
      });

      if (!shouldContinue) {
        return;
      }

      try {
        await spawnCopyDb({
          targetPassword,
          targetPort,
          targetUsername,
          sourceUsername,
          sourcePassword,
          sourcePort,
          sourceDbName,
          targetDbName,
        });
      } finally {
        sourceProxy?.stop();
        targetProxy?.stop();
      }
    });
