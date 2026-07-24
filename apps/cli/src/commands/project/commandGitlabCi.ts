import { exec } from "child-process-promise";
import { last } from "lodash-es";
import open from "open";
import { defineCommand } from "../../core/defineCommand";
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

const getJobChoices = async (io: any) => {
  const { id: projectId } = await getProjectInfo(io);
  const jobs = await doGitlabRequest(io, `projects/${projectId}/jobs`);
  const commitId = await getCurrentCommit();

  const jobsToName = (jo: any[]) =>
    jo.map(
      (j: any) => `${j.ref}-${j.name}-${j.user.username}-${j.status}-${j.id}`,
    );

  const preferredJobs = jobs.filter((j: any) => j.commit.id === commitId);
  const moreJobs = jobs.filter((j: any) => !preferredJobs.includes(j.ref));
  return preferredJobs.length > 1
    ? [
        ...jobsToName(preferredJobs),
        "========================================================",
        ...jobsToName(moreJobs),
      ]
    : jobsToName([...preferredJobs, ...moreJobs]);
};

const findJobById = async (io: any, jobName: string) => {
  const { id: projectId } = await getProjectInfo(io);
  const jobs = await doGitlabRequest(io, `projects/${projectId}/jobs`);
  const jobId = Number(last(jobName.split("-")));
  return { job: jobs.find((j: any) => j.id === jobId), projectId };
};

export const commandCiJobOpen = defineCommand({
  name: "project ci job-open",
  description: "Open a Job",
  group: "project",
  inputs: {
    jobName: {
      type: "string",
      message: "Which job? 🤔",
      choices: async (ctx) => getJobChoices(ctx),
    },
  },
  execute: async (ctx) => {
    const jobName = await ctx.get("jobName");
    const { job } = await findJobById(ctx, jobName);
    open(job.web_url);
  },
});

export const commandCiJobLog = defineCommand({
  name: "project ci job-log",
  description: "Show a job's log",
  group: "project",
  inputs: {
    jobName: {
      type: "string",
      message: "Which job? 🤔",
      choices: async (ctx) => getJobChoices(ctx),
    },
  },
  execute: async (ctx) => {
    const jobName = await ctx.get("jobName");
    const { job: selectedJob, projectId } = await findJobById(ctx, jobName);
    const id = selectedJob.id;

    let finished = false;
    while (!finished) {
      const trace = await exec(
        `curl -s --header "PRIVATE-TOKEN: ${await getGitlabToken(
          ctx,
        )}" "https://git.panter.ch/api/v4/projects/${projectId}/jobs/${id}/trace"`,
      );

      const job = await doGitlabRequest(
        ctx,
        `projects/${projectId}/jobs/${id}`,
      );

      if (trace.stdout) {
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
