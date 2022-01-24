import Vorpal from "vorpal";
import { reloadConfig } from "../../../../config/getProjectConfig";
import { showProjectBanner } from "./utils/showProjectBanner";

export default async (vorpal: Vorpal) =>
  vorpal
    .command("project-reload-config", "reloads the config")

    .action(async function () {
      await reloadConfig();
      await showProjectBanner(vorpal);
    });
