import yaml from "js-yaml";
import { pick } from "lodash";
import Vorpal from "vorpal";
import { getProjectPods } from "../../../../utils/projects";

import { envAutocompletion } from "./utils/autocompletions";
import ensureCluster from "./utils/ensureCluster";

export default (vorpal: Vorpal) =>
  vorpal
    .command("project-list-pods <env>", "list pods of local project")
    .autocomplete(envAutocompletion)
    .action(async function({ env }) {
      await ensureCluster.call(this);
      const pods = await getProjectPods(env);
      this.log(
        yaml.safeDump(
          pods.map(p => pick(p, ["metadata.name", "status.startTime"]))
        )
      );
    });
