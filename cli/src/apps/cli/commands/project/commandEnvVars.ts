import type Vorpal from "vorpal";
import {
  getEnvVarsResolved,
  parseChoice,
} from "../../../../config/getProjectConfig";
import { envAndComponents } from "./utils/autocompletions";

export default async (vorpal: Vorpal) =>
  vorpal
    .command("project-env-vars <envComponent>", "list env vars")
    .autocomplete(await envAndComponents())
    .action(async function ({ envComponent }) {
      const { env, componentName } = parseChoice(envComponent);
      const envvars = await getEnvVarsResolved(this, env, componentName);
      Object.keys(envvars).forEach((key) =>
        this.log(`${key}: ${envvars[key]}`)
      );
    });
