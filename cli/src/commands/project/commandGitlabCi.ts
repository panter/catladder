import { exec } from "child-process-promise";
import { last } from "lodash";
import open from "open";
import { defineCommand } from "../../core/defineCommand";
import type { IO } from "../../core/types";
import {
  doGitlabRequest,
  getGitlabToken,
  getProjectInfo,
} from "../../utils/gitlab";

const statusEmojiMap: any = {
  failed: "🙀",
  warning: "😿",
  pending: "🍺",
  running: "🏃‍",
  manual: "🤚",
  scheduled: "🍺",
  canceled: "😽",
  success: "😻",
  skipped: "🤭",
  created: "🍺",
};

const statusTxt = (status: any) =>
  statusEmojiMap[status] ? `${statusEmojiMap[status]} ${status}` : status;

const getCurrentCommit = async () => {
  const result = await exec("git rev-parse HEAD");
  return result.stdout && result.stdout.replace(/\n$/, "");
};

const delay = async (ms: any) =>
  new Promise((resolve) => setTimeout(resolve, ms));

const promptJob = async (io: IO, projectId: any) => {
  const jobs = await doGitlabRequest(io as any, `projects/${projectId}/jobs`);

  const commitId = await getCurrentCommit();

  const jobsToName = (jo: any[]) =>
    jo.map(
      (j: any) => `${j.ref}-${j.name}-${j.user.username}-${j.status}-${j.id}`,
    );

  const preferredJobs = jobs.filter((j: any) => j.commit.id === commitId);
  const moreJobs = jobs.filter((j: any) => !preferredJobs.includes(j.ref));
  const sortedJobs =
    preferredJobs.length > 1
      ? [
          ...jobsToName(preferredJobs),
          "========================================================",
          ...jobsToName(moreJobs),
        ]
      : jobsToName([...preferredJobs, ...moreJobs]);

  const jobName = await io.promptDirect({
    type: "string",
    name: "jobName",
    choices: () => sortedJobs,
    message: "Which job? 🤔",
  });

  const jobId = Number(last(jobName.split("-")));
  return jobs.find((j: any) => j.id === jobId);
};

export const commandCiJobOpen = defineCommand({
  name: "project-ci-job-open",
  description: "Open a Job",
  group: "project",
  inputs: {},
  execute: async (ctx) => {
    const { id: projectId } = await getProjectInfo(ctx as any);
    const job = await promptJob(ctx, projectId);
    open(job.web_url);
  },
});

export const commandCiJobLog = defineCommand({
  name: "project-ci-job-log",
  description: "Show a job's log",
  group: "project",
  inputs: {},
  execute: async (ctx) => {
    const { id: projectId } = await getProjectInfo(ctx as any);
    const { id } = await promptJob(ctx, projectId);

    let finished = false;
    while (!finished) {
      const trace = await exec(
        `curl -s --header "PRIVATE-TOKEN: ${await getGitlabToken(
          ctx as any,
        )}" "https://git.panter.ch/api/v4/projects/${projectId}/jobs/${id}/trace"`,
      );

      const job = await doGitlabRequest(
        ctx as any,
        `projects/${projectId}/jobs/${id}`,
      );

      if (trace.stdout) {
        // In terminal mode, we just log (no vorpal.ui.redraw equivalent yet)
        ctx.log(trace.stdout);
      } else {
        ctx.log(`\n${statusTxt(job.status)}\n${job.web_url}\n`);
      }

      finished = !!job.finished_at;
      if (!finished) {
        await delay(5000);
      }
    }
  },
});
