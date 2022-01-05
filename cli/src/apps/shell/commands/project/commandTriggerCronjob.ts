import { V1Job, V1ObjectMeta } from "@kubernetes/client-node";

import Vorpal from "vorpal";
import { k8sApiBatch, k8sApiBatchBeta } from "../../../../k8sApi";
import { logError } from "../../../../utils/log";
import { namespaceAutoCompletion } from "../general/namespaceAutoCompletion";

import { getProjectNamespace } from "../../../../utils/projects";
import { envAutocompletion } from "./utils/autocompletions";
import ensureCluster from "./utils/ensureCluster";

async function triggerCronjob(namespace: string) {
  const {
    body: { items: jobs },
  } = await k8sApiBatchBeta.listNamespacedCronJob(namespace);

  const jobNames = jobs.map((j) => j.metadata.name);

  const { jobName } = await this.prompt({
    type: "list",
    name: "jobName",
    choices: jobNames,
    message: "Which cronjob? 🤔",
  });

  const cronjob = jobs.find((j) => j.metadata.name === jobName);
  const jobSpec = cronjob.spec.jobTemplate.spec;

  const job = new V1Job();
  const metadata: Partial<V1ObjectMeta> = {
    name: `manual-${Math.round(Date.now() / 1000)}-${cronjob.metadata.name}`,
  };

  job.metadata = metadata as V1ObjectMeta;
  job.spec = jobSpec;
  try {
    const result = await k8sApiBatch.createNamespacedJob(namespace, job);

    this.log("");
    this.log(`yeah, you got a job, man. 😺 ${result.body.metadata.name}`);
    this.log("");
  } catch (e) {
    logError(this, "command failed", e.body);
  }
}
export default (vorpal: Vorpal) => {
  vorpal
    .command("trigger-cronjob <namespace>", "trigger cronjob")
    .autocomplete(namespaceAutoCompletion)
    .action(async function ({ namespace }) {
      await triggerCronjob.call(this, namespace);
    });
  vorpal
    .command("project-trigger-cronjob <env>", "trigger cronjob")
    .autocomplete(envAutocompletion)
    .action(async function ({ env }) {
      await ensureCluster.call(this);
      const namespace = await getProjectNamespace(env);
      await triggerCronjob.call(this, namespace);
    });
};
