import { exec } from "child-process-promise";
import {
  getAutoStopConfig,
  getEnabledPipelineTypes,
} from "@catladder/pipeline";
import { getProjectConfig } from "../../config/getProjectConfig";
import { defineCommand } from "../../core/defineCommand";
import type { IO } from "../../core/types";
import { doGitlabRequest, getProjectInfo } from "../../utils/gitlab";

const PIN_LABEL_COLOR = "#428fdc";

type GitlabMr = {
  iid: number;
  title: string;
  web_url: string;
  labels: string[];
};

/**
 * the configured pin label — errors when the project cannot pin
 * (github-only, or pinning disabled)
 */
const getPinLabel = async (): Promise<string> => {
  const config = await getProjectConfig();
  if (!config) {
    throw new Error("no catladder config found");
  }
  if (!getEnabledPipelineTypes(config).includes("gitlab")) {
    throw new Error(
      "pinning review apps needs the gitlab pipeline — github has no auto-stop, review apps live until the pull request is closed",
    );
  }
  const { pinLabel } = getAutoStopConfig(config);
  if (pinLabel === false) {
    throw new Error(
      "review-app pinning is disabled in this project (autoStop.pinLabel: false)",
    );
  }
  return pinLabel;
};

const findMr = async (
  io: IO,
  projectId: string,
  mrIid: number | undefined,
): Promise<GitlabMr> => {
  if (mrIid) {
    return doGitlabRequest(io, `projects/${projectId}/merge_requests/${mrIid}`);
  }
  const branch = (await exec("git rev-parse --abbrev-ref HEAD")).stdout.trim();
  const mrs = await doGitlabRequest<GitlabMr[]>(
    io,
    `projects/${projectId}/merge_requests?state=opened&source_branch=${encodeURIComponent(branch)}`,
  );
  if (!mrs?.length) {
    throw new Error(
      `no open merge request found for branch '${branch}' — pass one with --mr <iid>`,
    );
  }
  return mrs[0];
};

const ensurePinLabelExists = async (
  io: IO,
  projectId: string,
  pinLabel: string,
) => {
  const existing = await doGitlabRequest<Array<{ name: string }>>(
    io,
    `projects/${projectId}/labels?search=${encodeURIComponent(pinLabel)}`,
  );
  if (existing?.some((label) => label.name === pinLabel)) {
    return;
  }
  await doGitlabRequest(
    io,
    `projects/${projectId}/labels`,
    {
      name: pinLabel,
      color: PIN_LABEL_COLOR,
      description:
        "review apps of this MR are pinned — deploys use auto_stop_in: never (managed by catladder)",
    },
    "POST",
  );
  io.log(`created the '${pinLabel}' label in the project`);
};

export const commandMrPin = defineCommand({
  name: "mr pin",
  description:
    "pin the review apps of a merge request (disable their auto-stop) by adding the pin label; merging or closing the MR still stops them",
  group: "mr",
  inputs: {
    mr: {
      type: "number",
      message:
        "merge request IID (defaults to the open MR of the current branch)",
      positional: true,
      required: false,
    },
    pipeline: {
      type: "boolean",
      message:
        "trigger a merge-request pipeline so the pin takes effect immediately",
      required: false,
    },
  },
  execute: async (ctx) => {
    const pinLabel = await getPinLabel();
    const { id: projectId } = await getProjectInfo(ctx);
    const mr = await findMr(ctx, projectId, await ctx.get("mr"));

    await ensurePinLabelExists(ctx, projectId, pinLabel);

    if (mr.labels?.includes(pinLabel)) {
      ctx.log(`already pinned: mr!${mr.iid} carries the '${pinLabel}' label`);
    } else {
      await doGitlabRequest(
        ctx,
        `projects/${projectId}/merge_requests/${mr.iid}`,
        { add_labels: pinLabel },
        "PUT",
      );
      ctx.log(
        `📌 pinned mr!${mr.iid} "${mr.title}" — label '${pinLabel}' added`,
      );
    }

    // the label only affects pipelines created after it was set, so
    // trigger one — otherwise the currently deployed review apps keep
    // their old auto-stop timer until the next push
    if ((await ctx.get("pipeline")) ?? true) {
      const pipeline = await doGitlabRequest<{ web_url: string }>(
        ctx,
        `projects/${projectId}/merge_requests/${mr.iid}/pipelines`,
        {},
        "POST",
      );
      ctx.log(
        `🚀 triggered a pipeline so the pin takes effect now: ${pipeline.web_url}`,
      );
    } else {
      ctx.log("the pin takes effect with the next pipeline of the MR");
    }
  },
});

export const commandMrUnpin = defineCommand({
  name: "mr unpin",
  description:
    "unpin the review apps of a merge request — the auto-stop timer re-arms with the next deploy",
  group: "mr",
  inputs: {
    mr: {
      type: "number",
      message:
        "merge request IID (defaults to the open MR of the current branch)",
      positional: true,
      required: false,
    },
  },
  execute: async (ctx) => {
    const pinLabel = await getPinLabel();
    const { id: projectId } = await getProjectInfo(ctx);
    const mr = await findMr(ctx, projectId, await ctx.get("mr"));

    if (!mr.labels?.includes(pinLabel)) {
      ctx.log(`mr!${mr.iid} is not pinned (no '${pinLabel}' label)`);
      return;
    }
    await doGitlabRequest(
      ctx,
      `projects/${projectId}/merge_requests/${mr.iid}`,
      { remove_labels: pinLabel },
      "PUT",
    );
    ctx.log(`unpinned mr!${mr.iid} — label '${pinLabel}' removed`);
    ctx.log(
      "the deployed review apps stay pinned until the next deploy re-arms their auto-stop timer",
    );
  },
});
