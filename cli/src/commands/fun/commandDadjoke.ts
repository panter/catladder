import fetch from "node-fetch";
import { defineCommand } from "../../core/defineCommand";

export const commandDadjoke = defineCommand({
  name: "fun dadjoke",
  description: "something for jonas.",
  group: "fun",
  inputs: {},
  execute: async (ctx) => {
    const result = await fetch("https://icanhazdadjoke.com/", {
      headers: { Accept: "text/plain" },
    });
    const text = await result.text();
    ctx.log("");
    ctx.log(text);
    ctx.log("");
  },
});
