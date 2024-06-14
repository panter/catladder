import { exec } from "child-process-promise";
import { last } from "lodash";
import open from "open";
import type { CommandInstance } from "vorpal";
import type Vorpal from "vorpal";
import {
  doGitlabRequest,
  getGitlabToken,
  getProjectInfo,
} from "../../../../utils/gitlab";

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

const promptJob = async (vorpal: CommandInstance, projectId: any, ctx: any) => {
  const jobs = await doGitlabRequest(vorpal, `projects/${projectId}/jobs`);

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

  const { jobName } = await ctx.prompt({
    type: "list",
    name: "jobName",
    choices: sortedJobs,
    message: "Which job? 🤔",
  });

  const jobId = Number(last(jobName.split("-")));
  return jobs.find((j: any) => j.id === jobId);
};

export default async (vorpal: Vorpal) => {
  vorpal.command("project-ci-job-open", "Open a Job").action(async function () {
    const { id: projectId } = await getProjectInfo(this);

    const job = await promptJob(this, projectId, this);
    open(job.web_url);
  });

  vorpal
    .command("project-ci-job-log", "Show a job's log")
    .action(async function () {
      const { id: projectId } = await getProjectInfo(this);

      const { id } = await promptJob(this, projectId, this);

      let finished = false;
      while (!finished) {
        const trace = await exec(
          `curl -s --header "PRIVATE-TOKEN: ${await getGitlabToken(
            this,
          )}" "https://git.panter.ch/api/v4/projects/${projectId}/jobs/${id}/trace"`,
        );

        const job = await doGitlabRequest(
          this,
          `projects/${projectId}/jobs/${id}`,
        );

        if (trace.stdout) {
          vorpal.ui.redraw(`${trace.stdout}`);
        } else {
          vorpal.ui.redraw(`

          ${statusTxt(job.status)}
          ${job.web_url}

          `);
        }

        finished = !!job.finished_at;
        if (!finished) {
          await delay(5000);
        } else {
          vorpal.ui.redraw.done();
        }
      }
    });
};
