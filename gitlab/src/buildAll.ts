import { mkdirSync, writeFileSync } from "fs";
import { createGitlabBaseInclude } from "./createGitlabBaseInclude";
import { stringify } from "yaml";

const baseInclude = createGitlabBaseInclude();

mkdirSync("./includes", { recursive: true });
writeFileSync("./includes/main.yml", stringify(baseInclude), {
  encoding: "utf-8",
});
