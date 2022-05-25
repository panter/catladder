import catenv from "./apps/catenv/catenv";
import { $, argv } from "zx";
import { parseChoice } from "./config/getProjectConfig";

const choice = argv._[0] ? parseChoice(argv._[0]) : null;

$.verbose = false;
catenv(choice).then(() => {
  // we have to exit manually, because we have some file watches
  process.exit();
});
