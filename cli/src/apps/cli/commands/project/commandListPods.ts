import { stringify } from "yaml";
import { pick } from "lodash";
import type Vorpal from "vorpal";
import { getProjectPods } from "../../../../kubernetes";
import { envAndComponents } from "./utils/autocompletions";
import ensureCluster from "./utils/ensureCluster";

export default async (vorpal: Vorpal) =>
  vorpal
    .command("project-list-pods <envComponent>", "list pods of local project")
    .autocomplete(await envAndComponents())
    .action(async function ({ envComponent }) {
      await ensureCluster.call(this, envComponent);
      const pods = await getProjectPods(envComponent);
      this.log(
        stringify(
          pods.map((p) => pick(p, ["metadata.name", "status.startTime"]))
        )
      );
    });
