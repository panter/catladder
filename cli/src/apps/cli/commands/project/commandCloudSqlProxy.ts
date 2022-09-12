import { isOfDeployType } from "@catladder/pipeline";
import { spawn } from "child-process-promise";
import { writeFile } from "fs-extra";
import { withFile } from "tmp-promise";
import type Vorpal from "vorpal";
import {
  getEnvVars,
  getGitlabVar,
  getPipelineContextByChoice,
  getProjectConfig,
  parseChoice,
} from "../../../../config/getProjectConfig";
import { envAndComponents } from "./utils/autocompletions";

export default async (vorpal: Vorpal) =>
  vorpal
    .command("project-cloud-sql-proxy <envComponent>", "proxy to cloud sql db")
    .autocomplete(await envAndComponents())
    .action(async function ({ envComponent }) {
      const { env, componentName } = parseChoice(envComponent);

      const config = await getProjectConfig();
      // skynet-164509:europe-west6:pvl-cyclomania-review=tcp:5432

      const { localPort } = await this.prompt({
        type: "number",
        name: "localPort",
        default: "54320",
        message: "Local port: ",
      });

      const envVars = await getEnvVars(this, env, componentName);
      const POSTGRESQL_PASSWORD = envVars?.POSTGRESQL_PASSWORD;

      const context = await getPipelineContextByChoice(env, componentName);
      if (!isOfDeployType(context.componentConfig.deploy, "kubernetes")) {
        throw new Error("currently only supported for kubernetes deployment");
      }
      this.log("");
      this.log(`postgres-PW: ${POSTGRESQL_PASSWORD}`);
      this.log("");
      this.log(
        `POSTGRESQL_URL=postgresql://postgres:${POSTGRESQL_PASSWORD}@localhost:${localPort}/${context.environment.envVars.KUBE_APP_NAME}?schema=public`
      );
      this.log("");

      const values = context.componentConfig.deploy.values;

      const projectId =
        values?.cloudsql?.projectId ||
        context.componentConfig.deploy.cluster?.projectId;

      const defaultInstanceId = `${config.customerName}-${config.appName}-${env}`;
      const instanceId = values?.cloudsql?.instanceId || defaultInstanceId;

      const defaultRegion = "europe-west6"; // currently hardcoded
      const region = values?.cloudsql?.region || defaultRegion;

      const instanceName = `${projectId}:${region}:${instanceId}=tcp:${localPort}`;

      const cloudsqlProxyCredentials = await getGitlabVar(
        this,
        env,
        componentName,
        "cloudsqlProxyCredentials"
      );

      if (!cloudsqlProxyCredentials) {
        // we store cloudsqlProxyCredentials on gitlab, but its currently get pushed via bitwarden due to legacy reasons
        // this will be fixed with when https://git.panter.ch/catladder/catladder/-/merge_requests/32/ is merged
        this.log(
          "cloudsqlProxyCredentials env var missing in gitlab. Please contact gilde-ci-cd about that."
        );
        throw new Error("cloudsqlProxyCredentials missing in secrets");
      }
      await withFile(async ({ path: tmpFilePath }) => {
        await writeFile(tmpFilePath, cloudsqlProxyCredentials);

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
