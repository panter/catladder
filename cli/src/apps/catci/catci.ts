import Vorpal from "vorpal";
import packageInfo from "../../packageInfos";
import securityCommands from "./commands/security/commands";

function reconstructArgs(args: string[]): string {
  return [args[0], ...args.slice(1).map((arg) => `"${arg}"`)].join(" ");
}

export async function runCatCi() {
  const vorpal = new Vorpal();

  process.exitCode = 0;
  vorpal.delimiter("catci $").history("catci").version(packageInfo.version);

  securityCommands(vorpal);

  const isInteractive = process.argv.length <= 2;
  if (isInteractive) {
    vorpal.log(`Catladder CI Tools 😻🔨 version ${packageInfo.version}`).show();
  } else {
    process.exitCode = 1;
    const args = reconstructArgs(process.argv.slice(2));
    await vorpal.exec(args);
    process.exit();
  }
}
