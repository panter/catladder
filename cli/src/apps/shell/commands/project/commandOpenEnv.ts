import open from "open";
import Vorpal from "vorpal";
import { getLocalProjectVariables } from "../../../../utils/projects";

import { envAutocompletion } from "./utils/autocompletions";
import ensureCluster from "./utils/ensureCluster";

export default (vorpal: Vorpal) =>
  vorpal
    .command("project-open-env <env>", "open the live environment")
    .autocomplete(envAutocompletion)
    .action(async function ({ env }) {
      await ensureCluster.call(this);
      const { CUSTOMER_NAME, APP_NAME } = await getLocalProjectVariables();
      const url = `https://${APP_NAME}-${env}.${CUSTOMER_NAME}.panter.cloud`;

      open(url);
    });
