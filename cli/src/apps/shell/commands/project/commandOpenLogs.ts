import Vorpal from "vorpal";
import { getCurrentConnectedClusterName } from "../../../../utils/cluster";
import { getProjectNamespace } from "../../../../utils/projects";
import { getGoogleAuthUserNumber } from "../../utils/getGoogleAuthUserNumber";
import { openGoogleCloudLogs } from "../shared";
import { envAutocompletion } from "./utils/autocompletions";
import ensureCluster from "./utils/ensureCluster";

export default (vorpal: Vorpal) =>
  vorpal
    .command(
      "project-open-logs <env>",
      "open google cloud logs (stackdriver logs)"
    )
    .autocomplete(envAutocompletion)
    .action(async function ({ env }) {
      await ensureCluster.call(this);
      const clustername = await getCurrentConnectedClusterName();
      const namespace = await getProjectNamespace(env);
      const authGoogleNumber = await getGoogleAuthUserNumber.call(this, vorpal);

      await openGoogleCloudLogs(authGoogleNumber, clustername, namespace);
    });
