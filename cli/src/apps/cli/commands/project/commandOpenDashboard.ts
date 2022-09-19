import type { Context } from "@catladder/pipeline";
import { isOfDeployType } from "@catladder/pipeline";
import type Vorpal from "vorpal";
import type { CommandInstance } from "vorpal";
import {
  getPipelineContextByChoice,
  parseChoice,
} from "../../../../config/getProjectConfig";
import { getGoogleAuthUserNumber } from "../../utils/getGoogleAuthUserNumber";
import { openGoogleCloudKubernetesDashboard } from "../shared";
import { envAndComponents } from "./utils/autocompletions";

const openDashboardForKubernetes = async (
  instance: CommandInstance,
  context: Context
) => {
  const deployConfig = context.componentConfig.deploy;
  if (!isOfDeployType(deployConfig, "kubernetes")) {
    throw new Error("context is not of type kubernetes");
  }

  if (!deployConfig.cluster || deployConfig.cluster.type !== "gcloud") {
    throw new Error("no gcloud custer configured");
  }
  // currently only supports kubernetes
  const namespace = context.environment.envVars.KUBE_NAMESPACE;

  const authGoogleNumber = await getGoogleAuthUserNumber.call(instance);

  await openGoogleCloudKubernetesDashboard(
    deployConfig.cluster,
    namespace,
    authGoogleNumber
  );
};

const openDashboardForGoogleCloudRun = async (
  instance: CommandInstance,
  context: Context
) => {
  const deployConfig = context.componentConfig.deploy;
  if (!isOfDeployType(deployConfig, "google-cloudrun")) {
    throw new Error("context is not of type kubernetes");
  }

  if (!deployConfig.cluster || deployConfig.cluster.type !== "gcloud") {
    throw new Error("no gcloud custer configured");
  }
  // currently only supports kubernetes
  const namespace = context.environment.envVars.KUBE_NAMESPACE;

  const authGoogleNumber = await getGoogleAuthUserNumber.call(instance);

  await openGoogleCloudKubernetesDashboard(
    deployConfig.cluster,
    namespace,
    authGoogleNumber
  );
};
export default async (vorpal: Vorpal) =>
  vorpal
    .command(
      "project-open-dashboard <envComponent>",
      "open kubernetes dashboard on google"
    )
    .autocomplete(await envAndComponents())
    .action(async function ({ envComponent }) {
      const { env, componentName } = parseChoice(envComponent);
      const context = await getPipelineContextByChoice(env, componentName);
      if (isOfDeployType(context.componentConfig.deploy, "kubernetes")) {
        await openDashboardForKubernetes(this, context);
      }
      if (isOfDeployType(context.componentConfig.deploy, "google-cloudrun")) {
        await openDashboardForGoogleCloudRun(this, context);
      }
    });
