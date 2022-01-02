import updateNotifier from "update-notifier";
import { argv } from "yargs";
import catenv from "./apps/catenv/catenv";
import shell from "./apps/shell/shell";
import packageInfos from "./packageInfos";

// tslint:disable-next-line:no-var-requires

updateNotifier({
  pkg: packageInfos,
}).notify();

if (argv.catenv) {
  catenv();
} else {
  shell();
}
