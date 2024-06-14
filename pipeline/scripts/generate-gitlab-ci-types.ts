import { compile } from "json-schema-to-typescript";
import { resolve, join } from "path";
import { existsSync } from "fs";
import { rm, writeFile } from "fs/promises";

const rootPath = resolve(__dirname, "..");
const typeOutputPath = join(rootPath, "src/types/gitlab-ci-yml.ts");

export const generateFromCurrentSchema = async () => {
  const response = await fetch(
    "https://gitlab.com/gitlab-org/gitlab/-/raw/master/app/assets/javascripts/editor/schema/ci.json",
  );
  const gitLabCiJsonSchema = await response.json();
  const schema = await compile(gitLabCiJsonSchema, "GitlabCiYml", {
    additionalProperties: true,
    enableConstEnums: true,
    declareExternallyReferenced: true,
    unreachableDefinitions: true,
    strictIndexSignatures: true,
    unknownAny: false,
    ignoreMinAndMaxItems: true,
    format: true,
    style: {
      bracketSpacing: true,
      printWidth: 100,
      semi: true,
      tabWidth: 2,
      useTabs: false,
      trailingComma: "es5",
      endOfLine: "lf",
    },
    cwd: rootPath,
  });
  /**
   * Remove part that failes with tsc error
   * ```
   * error TS2411: Property '$schema' of type 'string | undefined' is not assignable to 'string' index type 'JobTemplate1'.
   * ```
   */
  const sanitizedSchenma = schema.replace(
    // eslint-disable-next-line no-useless-escape
    /export interface HttpsGitlabComGitlabCiYml \{\n[ a-zA-Z0-9?$:;\n_!"\{\}\/*@\[\],.|\(\)]*\[k\: string\]: Job;\n\}/m,
    "",
  );
  if (existsSync(typeOutputPath)) {
    await rm(typeOutputPath);
  }
  await writeFile(typeOutputPath, sanitizedSchenma, { encoding: "utf-8" });
};

generateFromCurrentSchema();
