import type Vorpal from "vorpal";
import { getProjectNamespace } from "../../../../utils/projects";
import { envAndComponents } from "./utils/autocompletions";

export default async (vorpal: Vorpal) =>
  vorpal
    .command(
      "project-namespace <envComponent>",
      "show namespace of local project"
    )
    .autocomplete(await envAndComponents())
    .action(async function ({ envComponent }) {
      this.log(await getProjectNamespace(envComponent));
    });
