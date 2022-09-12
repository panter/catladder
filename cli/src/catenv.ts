import catenv from "./apps/catenv/catenv";

import { parseChoice } from "./config/getProjectConfig";

const choice = process.argv[2] ? parseChoice(process.argv[2]) : null;

console.log(process.argv, choice);

catenv(choice).then(() => {
  // we have to exit manually, because we have some file watches
  process.exit();
});
