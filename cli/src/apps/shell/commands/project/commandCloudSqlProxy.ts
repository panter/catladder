import { spawn } from "child-process-promise";
import { writeFile } from "fs-extra";
import { withFile } from "tmp-promise";
import Vorpal from "vorpal";
import {
  GOOGLE_CLOUD_SQL_PASS_PATH,
  GOOGLE_PROJECT,
} from "../../../../config/constants";
import { readPass } from "../../../../utils/passwordstore";
import {
  getAllEnvVars,
  getLocalProjectVariables,
  getProjectValues,
} from "../../../../utils/projects";
import { envAutocompletion } from "./utils/autocompletions";
import { promptForSubAppIfAny } from "./utils/monorepo";

export default (vorpal: Vorpal) =>
  vorpal
    .command("project-cloud-sql-proxy <env>", "proxy to cloud sql db")
    .autocomplete(envAutocompletion)
    .action(async function ({ env }) {
      const { CUSTOMER_NAME, APP_NAME } = await getLocalProjectVariables();
      // skynet-164509:europe-west6:pvl-cyclomania-review=tcp:5432

      const { localPort } = await this.prompt({
        type: "number",
        name: "localPort",
        default: "54320",
        message: "Local port: ",
      });

      const subapp = await promptForSubAppIfAny(this);
      const POSTGRESQL_PASSWORD = (await getAllEnvVars(env, subapp))
        ?.POSTGRESQL_PASSWORD;

      const values = await getProjectValues(env, subapp);
      this.log("");
      this.log(`postgres-PW: ${POSTGRESQL_PASSWORD}`);
      this.log("");

      const projectId = values?.cloudsql?.projectId || GOOGLE_PROJECT;

      const defaultInstanceId = `${CUSTOMER_NAME}-${APP_NAME}-${env}`;
      const instanceId = values?.cloudsql?.instanceId || defaultInstanceId;

      const defaultRegion = "europe-west6"; // currently hardcoded
      const region = values?.cloudsql?.region || defaultRegion;

      const instanceName = `${projectId}:${region}:${instanceId}=tcp:${localPort}`;

      const cloudsqlCredentials = await readPass(GOOGLE_CLOUD_SQL_PASS_PATH);
      await withFile(async ({ path: tmpFilePath }) => {
        await writeFile(tmpFilePath, cloudsqlCredentials);

        await spawn(
          "cloud_sql_proxy",
          ["-instances", instanceName, "-credential_file", tmpFilePath],
          {
            stdio: "inherit",
            shell: true,
          }
        );
      });
    });
