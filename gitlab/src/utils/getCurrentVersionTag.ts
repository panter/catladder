import { spawnSync } from "child_process";

const result = spawnSync("git describe --tags || git rev-parse HEAD");

console.log(result);
