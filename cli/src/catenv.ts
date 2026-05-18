import { Command } from "commander";
import catenv from "./apps/catenv/catenv";
import { parseChoice } from "./config/parseChoice";
import packageInfos from "./packageInfos";

const program = new Command();

program
  .name("catenv")
  .description("Environment variable and pipeline generation via direnv")
  .version(packageInfos.version)
  .argument("[envComponent]", "env or env:component")
  .option("-v, --verbose", "verbose output")
  .action((envComponent: string | undefined, opts: { verbose?: boolean }) => {
    catenv(envComponent ? parseChoice(envComponent) : null, {
      verbose: opts.verbose ?? false,
    }).then(() => {
      // we have to exit manually, because we have some file watches
      process.exit();
    });
  });

program.parse();
