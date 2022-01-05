import Vorpal from "vorpal";
import { getEnvVars } from "../../../../config/getProjectConfig";
import { envAutocompletion } from "./utils/autocompletions";

export default (vorpal: Vorpal) =>
  vorpal
    .command("project-env-vars <envComponent>", "list env vars")
    .autocomplete(envAutocompletion)
    .action(async function ({ envComponent }) {
      const envvars = await getEnvVars(this, envComponent);
      Object.keys(envvars).forEach((key) =>
        this.log(`${key}: ${envvars[key]}`)
      );
    });
