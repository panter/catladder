import type Vorpal from "vorpal";
import {
  getEnvVarsResolved,
  parseChoice,
} from "../../../../config/getProjectConfig";
import { logError } from "../../../../utils/log";
import { startKubePortForward } from "../../../../kubernetes/portForward";
import { getProjectNamespace } from "../../../../utils/projects";
import { envAndComponents } from "../project/utils/autocompletions";
import ensureCluster from "../project/utils/ensureCluster";
import { getProjectMongodbAllPodsSortedWithLabel } from "./utils";
import clipboard from "clipboardy";

export default async (vorpal: Vorpal) =>
  vorpal
    .command(
      "project-mongo-port-forward <envComponent>",
      "port foward to a mongodb"
    )
    .autocomplete(await envAndComponents())
    .action(async function ({ envComponent }) {
      await ensureCluster.call(this, envComponent);
      const namespace = await getProjectNamespace(envComponent);
      const podNames = await getProjectMongodbAllPodsSortedWithLabel(
        envComponent
      );
      if (podNames.length === 0) {
        logError(this, "sorry, no pods found");
        return;
      }
      let podName;
      if (podNames.length === 1) {
        podName = podNames[0].value;
      } else {
        podName = (
          await this.prompt({
            type: "list",
            name: "podName",
            choices: podNames,
            message: "Which pod? 🤔",
          })
        ).podName;
      }

      const { localPort } = await this.prompt({
        type: "number",
        name: "localPort",
        default: "30000",
        message: "Local port: ",
      });
      const { env, componentName } = parseChoice(envComponent);
      const envVars = await getEnvVarsResolved(this, env, componentName);
      const MONGODB_ROOT_PASSWORD = envVars?.MONGODB_ROOT_PASSWORD;
      const connectionUrl = `mongodb://root:${MONGODB_ROOT_PASSWORD}@localhost:${localPort}`;
      clipboard.writeSync(connectionUrl);
      this.log("");
      this.log("username: root");
      this.log(`password: ${MONGODB_ROOT_PASSWORD}`);
      this.log(`connection string: ${connectionUrl}`);
      this.log("");
      this.log("👆 connection string has been copied to your clipboard!");
      this.log("");

      return startKubePortForward(podName, localPort, 27017, namespace);
    });
