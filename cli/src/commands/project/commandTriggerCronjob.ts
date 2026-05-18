import type { V1ObjectMeta } from "@kubernetes/client-node";
import { V1Job } from "@kubernetes/client-node";
import { defineCommand } from "../../core/defineCommand";
import { getk8sApiBatch, getk8sApiBatchBeta } from "../../k8sApi";
import { logError } from "../../utils/log";
import { getProjectNamespace } from "../../utils/projects";
import { ensureCluster } from "../../apps/cli/commands/project/utils/ensureCluster";
import type { IO } from "../../core/types";
import { envAndComponents } from "../../apps/cli/commands/project/utils/autocompletions";

async function triggerCronjob(io: IO, namespace: string) {
  const {
    body: { items: jobs },
  } = await getk8sApiBatchBeta().listNamespacedCronJob(namespace);

  const jobNames = jobs.map((j: any) => j.metadata.name);

  const jobName = await io.promptDirect({
    type: "string",
    name: "jobName",
    choices: () => jobNames,
    message: "Which cronjob? 🤔",
  });

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
}

export const commandTriggerCronjobGeneral = defineCommand({
  name: "trigger-cronjob",
  description: "trigger cronjob",
  group: "general",
  inputs: {
    namespace: {
      type: "string",
      message: "kubernetes namespace",
      positional: true,
    },
  },
  execute: async (ctx) => {
    const namespace = await ctx.get("namespace");
    await triggerCronjob(ctx, namespace);
  },
});

export const commandTriggerCronjobProject = defineCommand({
  name: "project-trigger-cronjob",
  description: "trigger cronjob",
  group: "project",
  inputs: {
    envComponent: {
      type: "string",
      message: "environment:component",
      positional: true,
      choices: async () => envAndComponents(),
    },
  },
  execute: async (ctx) => {
    const envComponent = await ctx.get("envComponent");
    await ensureCluster(ctx, envComponent);
    const namespace = await getProjectNamespace(envComponent);
    await triggerCronjob(ctx, namespace);
  },
});
