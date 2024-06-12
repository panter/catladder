import Vorpal from "vorpal";
// tslint:disable-next-line:no-var-requires
import packageInfos from "../../packageInfos";
import { stopAllPortForwards } from "../../utils/portForwards";
import general from "./commands/general";
import mongodb from "./commands/mongodb";
import cloudSQL from "./commands/cloudSQL";
import project from "./commands/project";
import theStuffThatReallyMatters from "./commands/theStuffThatReallyMatters";

import { verify } from "./verify";
import { showProjectBanner } from "./commands/project/utils/showProjectBanner";
import { boxWithAsci } from "../../utils/boxWithAscii";

export default async () => {
  const vorpal = new Vorpal();

  const welcomeMessage = boxWithAsci(
    `catladder 😻 v${packageInfos.version} ✨`
  );

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
  cloudSQL(vorpal);
  mongodb(vorpal);
  theStuffThatReallyMatters(vorpal);

  process.on("exit", () => {
    stopAllPortForwards();
  });
};
