import updateNotifier from "update-notifier";
import cli from "./apps/cli/cli";
import packageInfos from "./packageInfos";
import { $ } from "zx";
$.verbose = false;
updateNotifier({
  pkg: packageInfos,
}).notify();
cli();
