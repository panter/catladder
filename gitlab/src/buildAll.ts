import { mkdirSync, writeFileSync } from "fs";
import { createGitlabBaseInclude } from "./createGitlabBaseInclude";
import { stringify } from "yaml";

const baseInclude = createGitlabBaseInclude();

mkdirSync("./dist/includes", { recursive: true });
writeFileSync("./dist/includes/main.yml", stringify(baseInclude), {
  encoding: "utf-8",
});
