import type { Config } from "../../src";
import { createChildPipeline } from "../../src";

const ALL_TRIGGERS = ["mainBranch", "taggedRelease", "mr"] as const;

export const createAllPipelines = async (config: Config) =>
  Object.fromEntries(
    await Promise.all(
      ALL_TRIGGERS.map(async (trigger) => [
        trigger,
        await createChildPipeline("gitlab", trigger, config),
      ])
    )
  );
