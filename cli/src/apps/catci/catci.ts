import Vorpal from "vorpal";
import packageInfo from "../../packageInfos";
import securityCommands from "./commands/security/commands";

export async function runCatCi() {
  const vorpal = new Vorpal();

  process.exitCode = 0;
  vorpal.delimiter("catci $").history("catci").version(packageInfo.version);

  securityCommands(vorpal);

  const isInteractive = process.argv.length <= 2;
  if (isInteractive) {
    vorpal.log(`Catladder CI Tools 😻🔨 version ${packageInfo.version}`).show();
  } else {
    await vorpal.exec(process.argv.slice(2).join(" "));
    process.exit();
  }
}
