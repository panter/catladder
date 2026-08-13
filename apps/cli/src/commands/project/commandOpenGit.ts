import { exec } from "child-process-promise";
import { defineCommand } from "../../core/defineCommand";

export const commandOpenGit = defineCommand({
  name: "project open git",
  description: "open the repo on gitlab / github in your browser",
  group: "project",
  inputs: {},
  execute: async () => {
    await exec("npx git-open");
  },
});
