import Vorpal from "vorpal";
// tslint:disable-next-line:no-var-requires
import packageInfos from "../../packageInfos";
import { stopAllPortForwards } from "../../utils/portForward";
import general from "./commands/general";
import mongodb from "./commands/mongodb";
import project from "./commands/project";
import theStuffThatReallyMatters from "./commands/theStuffThatReallyMatters";
const welcomeMessage = `catladder 2 😻 version ${packageInfos.version}`;

export default () => {
  const vorpal = new Vorpal();

  vorpal
    .delimiter("catladder $") // emoji messes with cursor :-( https://github.com/dthree/vorpal/issues/332
    .history("catladder")
    .show()
    .log("")
    .log(welcomeMessage)
    .log("");

  general(vorpal);
  project(vorpal);
  mongodb(vorpal);
  theStuffThatReallyMatters(vorpal);

  process.on("exit", () => {
    stopAllPortForwards();
  });
};
