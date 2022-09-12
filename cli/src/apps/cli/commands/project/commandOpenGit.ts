import Vorpal from "vorpal";
import { exec } from "child-process-promise";

export default async (vorpal: Vorpal) =>
  vorpal
    .command(
      "project-open-git",
      "open the repo on gitlab / github in your browser"
    )
    .action(async () => {
      await exec("npx git-open");
    });
