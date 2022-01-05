import Vorpal from "vorpal";
import { config } from "yargs";
// tslint:disable-next-line:no-var-requires
import packageInfos from "../../packageInfos";
import { stopAllPortForwards } from "../../utils/portForward";
import general from "./commands/general";
import mongodb from "./commands/mongodb";
import project from "./commands/project";
import theStuffThatReallyMatters from "./commands/theStuffThatReallyMatters";

import { getProjectConfig } from "../../config/getProjectConfig";

export default () => {
  const projectConfig = getProjectConfig();
  const welcomeMessage = `catladder 2022 😻 version ${packageInfos.version}`;

  const vorpal = new Vorpal();

  vorpal
    .delimiter("catladder $") // emoji messes with cursor :-( https://github.com/dthree/vorpal/issues/332
    .history("catladder")
    .show()
    .log("")
    .log(welcomeMessage)
    .log("");
  if (projectConfig) {
    vorpal.log("project: " + projectConfig.appName);
    vorpal.log("customer: " + projectConfig.customerName);
  }

  general(vorpal);
  project(vorpal);
  mongodb(vorpal);
  theStuffThatReallyMatters(vorpal);

  process.on("exit", () => {
    stopAllPortForwards();
  });
};
