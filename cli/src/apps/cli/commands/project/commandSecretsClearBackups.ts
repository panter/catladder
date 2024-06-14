import type Vorpal from "vorpal";
import type { CommandInstance } from "vorpal";
import { clearBackups } from "../../../../utils/gitlab";
import { allEnvsAndAllComponents } from "./utils/autocompletions";

export const projectSecretsClearBackups = async (
  vorpal: CommandInstance,
  keep = 3,
) => {
  await clearBackups(vorpal, keep);
};

export default async (vorpal: Vorpal) => {
  vorpal
    .command("project-secrets-clear-backups", "clears all backups")
    .autocomplete(await allEnvsAndAllComponents())
    .action(async function () {
      const { keep } = await this.prompt({
        type: "number",
        name: "keep",
        default: 1,
        message: "How many backups should we keep? 🤔",
      });
      return await projectSecretsClearBackups(this, keep);
    });
};
