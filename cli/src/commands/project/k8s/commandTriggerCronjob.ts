import type { V1ObjectMeta } from "@kubernetes/client-node";
import { V1Job } from "@kubernetes/client-node";
import { defineCommand } from "../../../core/defineCommand";
import { getk8sApiBatch, getk8sApiBatchBeta } from "../../../k8sApi";
import { logError } from "../../../utils/log";
import { getProjectNamespace } from "../../../utils/projects";
import { ensureCluster } from "../../../apps/cli/commands/project/utils/ensureCluster";
import { envAndComponents } from "../../../apps/cli/commands/project/utils/autocompletions";
import { hasDeployType } from "../../availability";

const getCronjobChoices = async (namespace: string) => {
  const {
    body: { items: jobs },
  } = await getk8sApiBatchBeta().listNamespacedCronJob(namespace);
  return jobs.map((j: any) => j.metadata.name) as string[];
};

const runCronjob = async (
  io: { log: (msg: string) => void },
  namespace: string,
  jobName: string,
) => {
  const {
    body: { items: jobs },
  } = await getk8sApiBatchBeta().listNamespacedCronJob(namespace);

  const cronjob = jobs.find((j: any) => j.metadata.name === jobName);
  const jobSpec = (cronjob as any).spec.jobTemplate.spec;

  const job = new V1Job();
  const metadata: Partial<V1ObjectMeta> = {
    name: `manual-${Math.round(Date.now() / 1000)}-${(cronjob as any).metadata.name}`,
  };

  job.metadata = metadata as V1ObjectMeta;
  job.spec = jobSpec;
  try {
    const result = await getk8sApiBatch().createNamespacedJob(namespace, job);
    io.log("");
    io.log(
      `yeah, you got a job, man. 😺 ${(result as any).body.metadata.name}`,
    );
    io.log("");
  } catch (e: any) {
    logError(io, "command failed", e.body);
  }
};

export const commandTriggerCronjobGeneral = defineCommand({
  name: "k8s trigger-cronjob",
  description: "trigger cronjob",
  group: "general",
  inputs: {
    namespace: {
      type: "string",
      message: "kubernetes namespace",
      positional: true,
    },
    jobName: {
      type: "string",
      message: "Which cronjob? 🤔",
      choices: async (ctx) => getCronjobChoices(await ctx.get("namespace")),
    },
  },
  execute: async (ctx) => {
    const namespace = await ctx.get("namespace");
    const jobName = await ctx.get("jobName");
    await runCronjob(ctx, namespace, jobName);
  },
});

export const commandTriggerCronjobProject = defineCommand({
  name: "project k8s trigger-cronjob",
  description: "trigger cronjob",
  group: "project",
  isAvailable: hasDeployType("kubernetes"),
  inputs: {
    envComponent: {
      type: "string",
      message: "environment:component",
      positional: true,
      choices: async () => envAndComponents(),
    },
    jobName: {
      type: "string",
      message: "Which cronjob? 🤔",
      choices: async (ctx) => {
        const envComponent = await ctx.get("envComponent");
        const namespace = await getProjectNamespace(envComponent);
        return getCronjobChoices(namespace);
      },
    },
  },
  execute: async (ctx) => {
    const envComponent = await ctx.get("envComponent");
    await ensureCluster(ctx, envComponent);
    const namespace = await getProjectNamespace(envComponent);
    const jobName = await ctx.get("jobName");
    await runCronjob(ctx, namespace, jobName);
  },
});
