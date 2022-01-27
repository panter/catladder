import { mkdirSync, writeFileSync } from "fs";
import { createGitlabBaseInclude } from "./createGitlabBaseInclude";
import { dump } from "js-yaml";

const baseInclude = createGitlabBaseInclude();

mkdirSync("./dist/includes", { recursive: true });
writeFileSync("./dist/includes/gitlab-ci.yml", dump(baseInclude), {
  encoding: "utf-8",
});
