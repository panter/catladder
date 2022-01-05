import Vorpal from "vorpal";
import { exec, spawn } from "child-process-promise";
import { Env } from "../../../../types/types";
import { getProjectNamespace } from "../../../../utils/projects";
import { envAutocompletion } from "./utils/autocompletions";

export default (vorpal: Vorpal) =>
  vorpal
    .command(
      "project-delete <env>",
      "deletes a environment of a project (it deletes the namespace)"
    )
    .autocomplete(envAutocompletion)
    .action(async function ({ env }) {
      const namespace = await getProjectNamespace(env as Env);
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
