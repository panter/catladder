import type Vorpal from "vorpal";
import { exec } from "child-process-promise";
import { getProjectNamespace } from "../../../../utils/projects";
import { envAndComponents } from "./utils/autocompletions";

export default async (vorpal: Vorpal) =>
  vorpal
    .command(
      "project-pause <envComponent>",
      "halts all running pods (scales to 0)",
    )
    .autocomplete(await envAndComponents())
    .action(async function ({ envComponent }) {
      const namespace = await getProjectNamespace(envComponent);
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
