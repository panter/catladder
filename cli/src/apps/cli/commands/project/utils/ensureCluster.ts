import {
  isOfDeployType,
  getFullKubernetesClusterName,
} from "@catladder/pipeline";
import {
  getPipelineContextByChoice,
  parseChoice,
} from "../../../../../config/getProjectConfig";
import {
  connectToCluster,
  getCurrentConnectedClusterName,
} from "../../../../../utils/cluster";
import type { IO } from "../../../../../core/types";

/**
 * Ensures the user is connected to the correct Kubernetes cluster for the given envComponent.
 * If already connected, does nothing. If not, prompts for confirmation to switch (in interactive mode).
 *
 * Accepts an IO instance for logging and prompting.
 * Also works with Vorpal's CommandInstance via .call(this, envComponent) for backward compatibility.
 */
export async function ensureCluster(
  io: IO,
  envComponent: string,
): Promise<void> {
  const { env, componentName } = parseChoice(envComponent);
  const context = await getPipelineContextByChoice(env, componentName);
  if (!isOfDeployType(context.deploy?.config, "kubernetes")) {
    throw new Error("can't ensure cluster for non-kubernetes deployments");
  }
  const cluster = getFullKubernetesClusterName(context.deploy?.config.cluster);
  const connectedClusterName = await getCurrentConnectedClusterName();

  if (cluster !== connectedClusterName) {
    io.log(`you are currently connected to cluster '${connectedClusterName}'`);
    io.log(`but the project requires cluster '${cluster}'`);
    const shouldContinue = await io.confirm(
      `Do you want to connect to '${cluster}'?`,
    );
    if (!shouldContinue) {
      io.log("abort");
    } else {
      await connectToCluster(cluster);
      io.log(`connected to cluster '${cluster}'`);
    }
  }
}

/**
 * @deprecated Use `ensureCluster(io, envComponent)` instead.
 * Backward-compatible version that works with Vorpal's `.call(this, envComponent)` pattern.
 */
export default async function (this: any, envComponent: string) {
  // Bridge: wrap Vorpal's CommandInstance as IO
  const io: IO = {
    log: (message: string) => this.log(message),
    confirm: async (message: string) => {
      const result = await this.prompt({
        type: "confirm",
        name: "confirmed",
        message,
      });
      return result.confirmed;
    },
    promptDirect: async (spec) => {
      const result = await this.prompt(spec);
      return result[spec.name];
    },
  };
  return ensureCluster(io, envComponent);
}
