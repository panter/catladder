import Vorpal from "vorpal";
import { exec } from "child-process-promise";
import { getProjectNamespace } from "../../../../utils/projects";
import { envAndComponents } from "./utils/autocompletions";

export default async (vorpal: Vorpal) =>
  vorpal
    .command(
      "project-delete <envComponent>",
      "deletes a environment of a project (it deletes the namespace)"
    )
    .autocomplete(await envAndComponents())
    .action(async function ({ envComponent }) {
      const namespace = await getProjectNamespace(envComponent);
      const { shouldContinue } = await this.prompt({
        type: "confirm",
        name: "shouldContinue",
        message: `This will delete the ${namespace}. You have to reinitialize it if you need it in the future. All data will be lost. Continue? 🤔 `,
      });

      if (!shouldContinue) {
        return;
      }

      const fullCommand = `kubectl delete namespace ${namespace}`;
      const { stdout } = await exec(fullCommand, {
        env: {
          ...process.env,
          DEBUG: "",
        },
      });
      this.log(stdout);
    });
