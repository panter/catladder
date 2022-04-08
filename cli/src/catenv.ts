import catenv from "./apps/catenv/catenv";
import { $ } from "zx";
$.verbose = false;
catenv().then(() => {
  // we have to exit manually, because we have some file watches
  process.exit();
});
