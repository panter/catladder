import { Config } from "@catladder/pipeline";
import { spawn, exec } from "child-process-promise";
import { writeFile } from "fs-extra";
import { safeDump } from "js-yaml";
import { format } from "prettier";
import { CommandInstance } from "vorpal";
import { getGitRoot } from "../../../utils/projects";

export const writeConfig = async (
  vorpal: CommandInstance,
  config: Config,
  options?: {
    endComment?: string;
  }
) => {
  const gitRoot = await getGitRoot();
  const TS = "typescript (recommended)";
  const { configType } = await vorpal.prompt({
    type: "list",
    name: "configType",
    choices: [TS, "yaml"],
    message: "In which format do you want the config? 🤔",
  });
  vorpal.log("");
  if (configType === TS) {
    const content = format(
      `
      import type { Config } from "@catladder/pipeline";
      
      const config: Config = ${JSON.stringify(config)};

      export default config;

     
      ${options?.endComment ? `/*${options.endComment}*/` : ""}
      
      `,
      {
        parser: "babel",
      }
    );

    await writeFile(gitRoot + "/catladder.ts", content, {
      encoding: "utf-8",
    });
    vorpal.log("adding type @catladder/pipeline....");
    await spawn("yarn add @catladder/pipeline -DW", {
      shell: true,
    });
    await exec("git add " + gitRoot + "/catladder.ts");
  } else {
    const content = safeDump(config);

    await writeFile(
      gitRoot + "/catladder.yml",
      content +
        "\n\n" +
        (options.endComment
          ? "# " + options.endComment.split("\n").join("\n# ")
          : ""),
      {
        encoding: "utf-8",
      }
    );
    await exec("git add " + gitRoot + "/catladder.ts");
  }
  vorpal.log("done!");
  vorpal.log("");
};
