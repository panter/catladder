import yaml from "js-yaml";
import Vorpal from "vorpal";
import { getLocalProjectVariables } from "../../../../utils/projects";

export default (vorpal: Vorpal) =>
  vorpal
    .command("project-variables", "get local project variables")
    .action(async function () {
      const variables = await getLocalProjectVariables();
      this.log("");
      this.log(yaml.safeDump(variables));
      this.log("");
    });
