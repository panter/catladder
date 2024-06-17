import type Vorpal from "vorpal";
import { getProjectPodNames } from "../../../../kubernetes";
import { logError } from "../../../../utils/log";
import { startKubePortForward } from "../../../../kubernetes/portForward";
import { getProjectNamespace } from "../../../../utils/projects";
import { envAndComponents } from "./utils/autocompletions";
import ensureCluster from "./utils/ensureCluster";
import type { CommandInstance } from "vorpal";
import { parseChoice } from "../../../../config/parseChoice";
import { getPipelineContextByChoice } from "../../../../config/getProjectConfig";
import type { ComponentContext } from "@catladder/pipeline";
import { isOfDeployType } from "@catladder/pipeline";
import { startPortForwardCommand } from "../../../../utils/portForwards";
import open from "open";
const kubePortForward = async (cmd: CommandInstance, envComponent: string) => {
  await ensureCluster.call(cmd, envComponent);
  const namespace = await getProjectNamespace(envComponent);
  const podNames = await getProjectPodNames(envComponent);
  if (podNames.length === 0) {
    logError(cmd, "sorry, no pods found");
    return;
  }
  const { podName } = await cmd.prompt({
    type: "list",
    name: "podName",
    choices: podNames,
    message: "Which pod? 🤔",
  });

  const { localPort } = await cmd.prompt({
    type: "number",
    name: "localPort",

    message: "Local port: ",
  });

  const { remotePort } = await cmd.prompt({
    type: "number",
    name: "remotePort",

    message: "Remote port: ",
  });

  return startKubePortForward(podName, localPort, remotePort, namespace);
};

const cloudRunPortForward = async (
  cmd: CommandInstance,
  context: ComponentContext,
) => {
  if (!isOfDeployType(context.deploy?.config, "google-cloudrun")) {
    throw new Error("not cloud run");
  }

  const { fullName } = context.environment;
  let serviceName: string = fullName.toString();
  if (context.environment.envType === "review") {
    const { mr } = await cmd.prompt({
      type: "number",
      name: "mr",

      message: "Which mr 🤔 ",
    });
    // poor mans solution
    serviceName = serviceName
      .toString()
      .replace("-review-", "-review-mr" + mr + "-");
  }

  const { projectId, region } = context.deploy.config;

  const command = `gcloud beta run services proxy ${serviceName} --project ${projectId} --region ${region}`;

  await startPortForwardCommand(`cloudRun/${serviceName}`, command);
  open("http://localhost:8080");
};
export default async (vorpal: Vorpal) =>
  vorpal
    .command("project-port-forward <envComponent>", "start port-forwarding")
    .autocomplete(await envAndComponents())
    .action(async function ({ envComponent }) {
      const { env, componentName } = parseChoice(envComponent);
      const context = await getPipelineContextByChoice(env, componentName);

      if (isOfDeployType(context.deploy?.config, "kubernetes")) {
        await kubePortForward(this, envComponent);
      }
      if (isOfDeployType(context.deploy?.config, "google-cloudrun")) {
        await cloudRunPortForward(this, context);
      }
    });
