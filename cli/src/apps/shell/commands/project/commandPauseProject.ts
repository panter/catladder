import Vorpal from "vorpal";
import { exec } from "child-process-promise";
import { Env } from "../../../../types/types";
import { getProjectNamespace } from "../../../../utils/projects";
import { envAutocompletion } from "./utils/autocompletions";

export default (vorpal: Vorpal) =>
  vorpal
    .command("project-pause <env>", "halts all running pods (scales to 0)")
    .autocomplete(envAutocompletion)
    .action(async function ({ env }) {
      const namespace = await getProjectNamespace(env as Env);
      const { shouldContinue } = await this.prompt({
        type: "confirm",
        name: "shouldContinue",
        message: `This will STOP all running pods in the namespace ${namespace}. You will need to manually scale back up or re-deploy. Continue? 🤔 `,
      });

      if (!shouldContinue) {
        return;
      }

      const fullCommand = `kubectl scale statefulset,deployment --all --replicas=0 --namespace=${namespace}`;
      const { stdout } = await exec(fullCommand, {
        env: {
          ...process.env,
          DEBUG: "",
        },
      });
      this.log(stdout);
    });
