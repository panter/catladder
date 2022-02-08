import { spawn } from "child-process-promise";
import fetch from "node-fetch";
import Vorpal from "vorpal";

export default async (vorpal: Vorpal) => {
  vorpal.command("dadjoke", "something for jonas.").action(async function () {
    const result = await fetch("https://icanhazdadjoke.com/", {
      headers: {
        Accept: "text/plain",
      },
    });
    const text = await result.text();
    this.log("");
    this.log(text);
    this.log("");
  });

  let starwarsPromise: any;
  vorpal
    .command("starwars", "Long time ago... in a galaxy far far away...")
    .action(async function () {
      starwarsPromise = spawn("telnet", ["towel.blinkenlights.nl"], {
        stdio: ["pipe", "inherit", "pipe"],
      });
      await starwarsPromise;
    })
    // we need to close it properly, because telnet towel.blinkenlights.nl has no way to cancel and stop itself
    // this is also why we need to only inherit the stdout and not the stdin
    .cancel(async function () {
      starwarsPromise.childProcess.kill();
    });
};
