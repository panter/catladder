import { glob } from "glob";
import { resolve, join, basename } from "path";
import { existsSync } from "fs";
import { readFile, writeFile, rm } from "fs/promises";
import { format } from "prettier";

const pipelineWorkspaceRoot = resolve(__dirname, "..");
const examplesPath = join(pipelineWorkspaceRoot, "examples");
const exampleIgnoresPath = join(examplesPath, ".test-gen-ignore");

const defaultExampleIgnores = ["*.test.ts"];

async function getExampleIgnores(): Promise<string[]> {
  if (!existsSync(exampleIgnoresPath)) {
    await writeFile(exampleIgnoresPath, defaultExampleIgnores.join("\n"));
  }
  try {
    const ignoresFile = await readFile(exampleIgnoresPath, {
      encoding: "utf-8",
    });
    return [
      ...new Set([
        ...defaultExampleIgnores,
        ...ignoresFile
          .split("\n")
          .filter((line) => !line.match(/^\s*# [\s\w]*/))
          .map((line) => line.trim())
          .filter(Boolean),
      ]),
    ];
  } catch (error) {
    console.error(
      `Error reading example ignores file: ${exampleIgnoresPath}`,
      error,
    );
    return defaultExampleIgnores;
  }
}

async function main() {
  const exampleIgnores = await getExampleIgnores();
  const [exampleFiles, existingTestFiles] = await Promise.all([
    glob("*.ts", {
      ignore: exampleIgnores,
      cwd: examplesPath,
    }),
    glob("*.test.ts", {
      ignore: ["rails-k8s-with-worker-dockerfile.test.ts"],
      cwd: examplesPath,
    }),
  ]);
  await Promise.all(
    existingTestFiles.map((testFile) => rm(join(examplesPath, testFile))),
  );
  await Promise.all(
    exampleFiles.map(async (exampleFile) => {
      const kebabName = basename(exampleFile, ".ts");
      const testFileContent = [
        `import { it, expect } from "vitest";`,
        `import { createYamlGithubWorkflows, createYamlLocalPipeline } from "./__utils__/helpers";`,
        `import config from "./${kebabName}";`,
        `\n/**`,
        ` * This test is auto-generated.`,
        ` * Modifications will be overwritten on every \`yarn test\` run!`,
        ` */\n`,

        `it("matches snapshot for ${kebabName} local pipeline YAML", async () => {`,
        `  expect(await createYamlLocalPipeline(config)).toMatchSnapshot();`,
        `});\n`,
        `it("matches snapshot for ${kebabName} github workflows YAML", async () => {`,
        `  expect(await createYamlGithubWorkflows(config)).toMatchSnapshot();`,
        `});\n`,
      ].join("\n");
      const formattedTest = await format(testFileContent, {
        parser: "typescript",
      });
      await writeFile(
        join(examplesPath, `${kebabName}.test.ts`),
        formattedTest,
        {
          encoding: "utf-8",
        },
      );
    }),
  );
}

main().catch(console.error);
