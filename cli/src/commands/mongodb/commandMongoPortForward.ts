import { defineCommand } from "../../core/defineCommand";
import { getEnvVarsResolved, parseChoice } from "../../config/getProjectConfig";

import { startKubePortForward } from "../../kubernetes/portForward";
import { getProjectNamespace } from "../../utils/projects";
import { ensureCluster } from "../../apps/cli/commands/project/utils/ensureCluster";
import { getProjectMongodbAllPodsSortedWithLabel } from "../../apps/cli/commands/mongodb/utils";
import clipboard from "clipboardy";
import { envAndComponents } from "../../apps/cli/commands/project/utils/autocompletions";
import { hasDeployType } from "../availability";

export const commandMongoPortForward = defineCommand({
  name: "project mongo port-forward",
  description: "port forward to a mongodb",
  group: "mongodb",
  isAvailable: hasDeployType("kubernetes"),
  inputs: {
    envComponent: {
      type: "string",
      message: "environment:component",
      positional: true,
      choices: async () => envAndComponents(),
    },
    podName: {
      type: "string",
      message: "Which pod? 🤔",
      choices: async (ctx) =>
        getProjectMongodbAllPodsSortedWithLabel(await ctx.get("envComponent")),
    },
    localPort: {
      type: "number",
      message: "Local port: ",
      default: 30000,
    },
  },
  execute: async (ctx) => {
    const envComponent = await ctx.get("envComponent");
    await ensureCluster(ctx, envComponent);
    const namespace = await getProjectNamespace(envComponent);
    const podName = await ctx.get("podName");

    const localPort = await ctx.get("localPort");
    const { env, componentName } = parseChoice(envComponent);
    const envVars = await getEnvVarsResolved(ctx, env, componentName);
    const MONGODB_ROOT_PASSWORD = envVars?.MONGODB_ROOT_PASSWORD;
    const connectionUrl = `mongodb://root:${MONGODB_ROOT_PASSWORD}@localhost:${localPort}`;
    clipboard.writeSync(connectionUrl);
    ctx.log("");
    ctx.log("username: root");
    ctx.log(`password: ${MONGODB_ROOT_PASSWORD}`);
    ctx.log(`connection string: ${connectionUrl}`);
    ctx.log("");
    ctx.log("👆 connection string has been copied to your clipboard!");
    ctx.log("");

    return startKubePortForward(podName, localPort, 27017, namespace);
  },
});
