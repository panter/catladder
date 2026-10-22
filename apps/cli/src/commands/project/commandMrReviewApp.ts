import {
  getEnabledPipelineTypes,
  getReviewAppsConfig,
  getReviewAppsSwitchLabel,
} from "@catladder/pipeline";
import { getProjectConfig } from "../../config/getProjectConfig";
import { defineCommand } from "../../core/defineCommand";
import { doGitlabRequest, getProjectInfo } from "../../utils/gitlab";
import { ensureLabelExists, findMr } from "./commandMrPin";

/**
 * the label switch of the project's review apps — errors when the
 * project has none (github, or a policy without labels)
 */
const getSwitch = async () => {
  const config = await getProjectConfig();
  if (!config) {
    throw new Error("no catladder config found");
  }
  const reviewApps = getReviewAppsConfig(config);
  const switchLabel = getReviewAppsSwitchLabel(reviewApps);
  if (!switchLabel) {
    throw new Error(
      reviewApps.deploy === "manual"
        ? "review apps deploy on request in this project (reviewApps.deploy: manual) — play the '🚀 deploy review' job of the MR pipeline"
        : "review apps of this project are not switched by label (set reviewApps.deploy to optIn or optOut)",
    );
  }
  if (!getEnabledPipelineTypes(config).includes("gitlab")) {
    throw new Error(
      `this command switches gitlab merge requests — on github, set the label on the pull request instead (gh pr edit --${switchLabel.deployOn === "labeled" ? "add" : "remove"}-label ${switchLabel.label}); the label change deploys by itself`,
    );
  }
  return switchLabel;
};

const mrInput = {
  mr: {
    type: "number",
    message:
      "merge request IID (defaults to the open MR of the current branch)",
    positional: true,
    required: false,
  },
} as const;

export const commandMrReviewAppOn = defineCommand({
  name: "mr review-app-on",
  description:
    "deploy the review apps of a merge request: switches the reviewApps label on (opt-in: adds it, opt-out: removes the skip label) and triggers a pipeline, since gitlab doesn't start one for label changes",
  group: "mr",
  inputs: {
    ...mrInput,
    pipeline: {
      type: "boolean",
      message: "trigger a merge-request pipeline so the review apps deploy now",
      required: false,
    },
  },
  execute: async (ctx) => {
    const switchLabel = await getSwitch();
    const { id: projectId } = await getProjectInfo(ctx);
    const mr = await findMr(ctx, projectId, await ctx.get("mr"));

    if (switchLabel.deployOn === "labeled") {
      await ensureLabelExists(
        ctx,
        projectId,
        switchLabel.label,
        "review apps of this MR deploy (managed by catladder)",
      );
    }
    const hasLabel = mr.labels?.includes(switchLabel.label);
    if (hasLabel === (switchLabel.deployOn === "labeled")) {
      ctx.log(`review apps of mr!${mr.iid} are already switched on`);
    } else {
      await doGitlabRequest(
        ctx,
        `projects/${projectId}/merge_requests/${mr.iid}`,
        switchLabel.deployOn === "labeled"
          ? { add_labels: switchLabel.label }
          : { remove_labels: switchLabel.label },
        "PUT",
      );
      ctx.log(
        `review apps of mr!${mr.iid} "${mr.title}" switched on — label '${switchLabel.label}' ${switchLabel.deployOn === "labeled" ? "added" : "removed"}`,
      );
    }

    if ((await ctx.get("pipeline")) ?? true) {
      const pipeline = await doGitlabRequest<{ web_url: string }>(
        ctx,
        `projects/${projectId}/merge_requests/${mr.iid}/pipelines`,
        {},
        "POST",
      );
      ctx.log(`🚀 triggered a pipeline that deploys them: ${pipeline.web_url}`);
    } else {
      ctx.log("the review apps deploy with the next pipeline of the MR");
    }
  },
});

export const commandMrReviewAppOff = defineCommand({
  name: "mr review-app-off",
  description:
    "stop deploying the review apps of a merge request: switches the reviewApps label off (opt-in: removes it, opt-out: adds the skip label). Running review apps stay until the MR closes or they auto-stop",
  group: "mr",
  inputs: mrInput,
  execute: async (ctx) => {
    const switchLabel = await getSwitch();
    const { id: projectId } = await getProjectInfo(ctx);
    const mr = await findMr(ctx, projectId, await ctx.get("mr"));

    if (switchLabel.stopOn === "labeled") {
      await ensureLabelExists(
        ctx,
        projectId,
        switchLabel.label,
        "review apps of this MR don't deploy (managed by catladder)",
      );
    }
    const hasLabel = mr.labels?.includes(switchLabel.label);
    if (hasLabel === (switchLabel.stopOn === "labeled")) {
      ctx.log(`review apps of mr!${mr.iid} are already switched off`);
      return;
    }
    await doGitlabRequest(
      ctx,
      `projects/${projectId}/merge_requests/${mr.iid}`,
      switchLabel.stopOn === "labeled"
        ? { add_labels: switchLabel.label }
        : { remove_labels: switchLabel.label },
      "PUT",
    );
    ctx.log(
      `review apps of mr!${mr.iid} switched off — label '${switchLabel.label}' ${switchLabel.stopOn === "labeled" ? "added" : "removed"}`,
    );
    ctx.log(
      "already running review apps stay until the MR is closed or they auto-stop — stop them earlier with the stop job of the MR pipeline",
    );
  },
});
