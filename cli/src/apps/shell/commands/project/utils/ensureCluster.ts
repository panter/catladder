import {
  connectToCluster,
  getCurrentConnectedClusterName,
} from "../../../../../utils/cluster";
import { getLocalProjectVariables } from "../../../../../utils/projects/index";
export default async function () {
  const { CLUSTER_NAME } = await getLocalProjectVariables();
  if (!CLUSTER_NAME) {
    throw new Error("no CLUSTER_NAME configured in current project");
  }
  const connectedClusterName = await getCurrentConnectedClusterName();

  if (CLUSTER_NAME !== connectedClusterName) {
    this.log(
      `you are currently connected to cluster '${connectedClusterName}'`
    );
    this.log(`but the project requires cluster '${CLUSTER_NAME}'`);
    const { shouldContinue } = await this.prompt({
      type: "confirm",
      name: "shouldContinue",
      default: true,
      message: `Do you want to connect to '${CLUSTER_NAME}'?`,
    });
    if (!shouldContinue) {
      this.log("abort");
    } else {
      await connectToCluster(CLUSTER_NAME);
      this.log(`connected to cluster '${CLUSTER_NAME}'`);
    }
  }
}
