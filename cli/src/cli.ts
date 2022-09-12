import updateNotifier from "update-notifier";
import cli from "./apps/cli/cli";
import packageInfos from "./packageInfos";

updateNotifier({
  pkg: packageInfos,
}).notify();
cli();
