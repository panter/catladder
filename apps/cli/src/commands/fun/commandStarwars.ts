import { spawn } from "child-process-promise";
import { defineCommand } from "../../core/defineCommand";

export const commandStarwars = defineCommand({
  name: "fun starwars",
  description: "Long time ago... in a galaxy far far away...",
  group: "fun",
  inputs: {},
  execute: async () => {
    await spawn("nc", ["towel.blinkenlights.nl", "23"], {
      stdio: ["pipe", "inherit", "pipe"],
    });
  },
});
