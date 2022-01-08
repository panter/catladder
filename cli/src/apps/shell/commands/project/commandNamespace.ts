import Vorpal from "vorpal";
import { getProjectNamespace } from "../../../../utils/projects";
import { envAutocompletion } from "./utils/autocompletions";

export default (vorpal: Vorpal) =>
  vorpal
    .command(
      "project-namespace <envComponent>",
      "show namespace of local project"
    )
    .autocomplete(envAutocompletion)
    .action(async function ({ envComponent }) {
      this.log(await getProjectNamespace(envComponent));
    });
