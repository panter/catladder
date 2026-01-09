import catenv from "./apps/catenv/catenv";

import { parseChoice } from "./config/parseChoice";

const args = process.argv.slice(2);

const helpFlags = ["--help", "-h", "help"];
if (args.some((arg) => helpFlags.includes(arg))) {
  const docLink =
    "https://git.panter.ch/catladder/catladder/-/blob/main/docs/1_VARS.md";
  console.log(
    `\nUsage: catenv [env|env:component] [-v|--verbose]\n\nEnv variable and catenv documentation:\n${docLink}`,
  );
  process.exit(0);
}

const verbose = args.some((arg) => arg === "-v" || arg === "--verbose");
// choise arg is deprecated and will be removed in the future
const choiceArg = args.find((arg) => arg !== "-v" && arg !== "--verbose");

catenv(choiceArg ? parseChoice(choiceArg) : null, { verbose }).then(() => {
  // we have to exit manually, because we have some file watches
  process.exit();
});
