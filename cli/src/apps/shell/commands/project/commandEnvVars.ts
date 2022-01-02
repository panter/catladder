import Vorpal from "vorpal";
import { getAllEnvVars } from "../../../../utils/projects";
import { envAutocompletion } from "./utils/autocompletions";
import { promptForSubAppIfAny } from "./utils/monorepo";

export default (vorpal: Vorpal) =>
  vorpal
    .command("project-env-vars <env>", "list env vars")
    .autocomplete(envAutocompletion)
    .action(async function ({ env }) {
      const subApp = await promptForSubAppIfAny(this);

      const envvars = await getAllEnvVars(env, subApp);
      Object.keys(envvars).forEach((key) =>
        this.log(`${key}: ${envvars[key]}`)
      );
    });
