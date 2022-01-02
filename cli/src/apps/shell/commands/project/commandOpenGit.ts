import { exec } from "child-process-promise";
import Vorpal from "vorpal";

export default (vorpal: Vorpal) =>
  vorpal
    .command(
      "project-open-git",
      "open the repo on gitlab / github in your browser"
    )
    .action(async () => {
      await exec("npx git-open");
    });
