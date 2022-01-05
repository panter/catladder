import Vorpal from "vorpal";
import { Env } from "../../../../types/types";
import { getProjectNamespace } from "../../../../utils/projects";
import { envAutocompletion } from "./utils/autocompletions";

export default (vorpal: Vorpal) =>
  vorpal
    .command("project-namespace <env>", "show namespace of local project")
    .autocomplete(envAutocompletion)
    .action(async function({ env }) {
      this.log(await getProjectNamespace(env as Env));
    });
