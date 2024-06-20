import catenv from "./apps/catenv/catenv";

import { parseChoice } from "./config/parseChoice";

const args = process.argv.slice(2);

const helpFlags = ["--help", "-h", "help"];
if (args.some((arg) => helpFlags.includes(arg))) {
  const docLink =
    "https://git.panter.ch/catladder/catladder/-/blob/main/docs/1_VARS.md";
  console.log(
    `\nUsage: catenv [env|env:component]\n\nEnv variable and catenv documentation:\n${docLink}`,
  );
  process.exit(0);
}

catenv(args[0] ? parseChoice(args[0]) : null).then(() => {
  // we have to exit manually, because we have some file watches
  process.exit();
});
