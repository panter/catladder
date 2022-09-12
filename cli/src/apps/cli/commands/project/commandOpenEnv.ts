import open from "open";
import type Vorpal from "vorpal";
import {
  getEnvironment,
  parseChoice,
} from "../../../../config/getProjectConfig";

import { envAndComponents } from "./utils/autocompletions";
import ensureCluster from "./utils/ensureCluster";

export default async (vorpal: Vorpal) =>
  vorpal
    .command("project-open-env <envComponent>", "open the live environment")
    .autocomplete(await envAndComponents())
    .action(async function ({ envComponent }) {
      const { env, componentName } = parseChoice(envComponent);
      await ensureCluster.call(this, envComponent);
      const environment = await getEnvironment(env, componentName);
      const url = environment.url;

      open(url);
    });
