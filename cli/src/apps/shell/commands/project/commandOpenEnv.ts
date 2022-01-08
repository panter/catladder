import open from "open";
import Vorpal from "vorpal";
import { getEnvironmentByChoice } from "../../../../config/getProjectConfig";

import { envAutocompletion } from "./utils/autocompletions";
import ensureCluster from "./utils/ensureCluster";

export default (vorpal: Vorpal) =>
  vorpal
    .command("project-open-env <envComponent>", "open the live environment")
    .autocomplete(envAutocompletion)
    .action(async function ({ envComponent }) {
      await ensureCluster.call(this, envComponent);
      const environment = getEnvironmentByChoice(envComponent);
      const url = environment.url;

      open(url);
    });
