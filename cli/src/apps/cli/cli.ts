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
import { verify } from "./verify";
import { showProjectBanner } from "./commands/project/utils/showProjectBanner";

export default async () => {
  const vorpal = new Vorpal();

  const welcomeMessage = `catladder 2022 😻 version ${packageInfos.version}`;

  vorpal
    .delimiter("catladder $") // emoji messes with cursor :-( https://github.com/dthree/vorpal/issues/332
    .history("catladder")
    .show()
    .log("")
    .log(welcomeMessage)
    .log("");

  await showProjectBanner(vorpal);

  verify(vorpal);

  general(vorpal);
  project(vorpal);
  mongodb(vorpal);
  theStuffThatReallyMatters(vorpal);

  process.on("exit", () => {
    stopAllPortForwards();
  });
};
