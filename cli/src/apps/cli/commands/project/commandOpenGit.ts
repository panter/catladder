import Vorpal from "vorpal";
import { $ } from "zx";

export default async (vorpal: Vorpal) =>
  vorpal
    .command(
      "project-open-git",
      "open the repo on gitlab / github in your browser"
    )
    .action(async () => {
      await $`npx git-open`;
    });
