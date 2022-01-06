import yaml from "js-yaml";
import { pick } from "lodash";
import Vorpal from "vorpal";
import { getProjectPods } from "../../../../utils/projects";
import { envAutocompletion } from "./utils/autocompletions";
import ensureCluster from "./utils/ensureCluster";

export default (vorpal: Vorpal) =>
  vorpal
    .command("project-list-pods <envComponent>", "list pods of local project")
    .autocomplete(envAutocompletion)
    .action(async function ({ envComponent }) {
      await ensureCluster.call(this, envComponent);
      const pods = await getProjectPods(envComponent);
      this.log(
        yaml.safeDump(
          pods.map((p) => pick(p, ["metadata.name", "status.startTime"]))
        )
      );
    });
