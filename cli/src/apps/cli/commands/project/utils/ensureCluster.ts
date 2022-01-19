import { isOfDeployType } from "@catladder/pipeline";
import {
  getPipelineContextByChoice,
  parseChoice,
} from "../../../../../config/getProjectConfig";
import {
  connectToCluster,
  getCurrentConnectedClusterName,
} from "../../../../../utils/cluster";
export default async function (envComponent: string) {
  const { env, componentName } = parseChoice(envComponent);
  const context = await getPipelineContextByChoice(env, componentName);
  if (!isOfDeployType(context.componentConfig.deploy, "kubernetes")) {
    throw new Error("can't ensure cluster for non-kubernetes deployments");
  }
  const cluster = context.componentConfig.deploy.cluster || "production";
  const connectedClusterName = await getCurrentConnectedClusterName();

  if (cluster !== connectedClusterName) {
    this.log(
      `you are currently connected to cluster '${connectedClusterName}'`
    );
    this.log(`but the project requires cluster '${cluster}'`);
    const { shouldContinue } = await this.prompt({
      type: "confirm",
      name: "shouldContinue",
      default: true,
      message: `Do you want to connect to '${cluster}'?`,
    });
    if (!shouldContinue) {
      this.log("abort");
    } else {
      await connectToCluster(cluster);
      this.log(`connected to cluster '${cluster}'`);
    }
  }
}
