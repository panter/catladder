import { rm, readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join, resolve, basename } from "path";
import { glob } from "glob";
import { format } from "prettier";

/**
 * With the env variable DOCS_EXAMPLES_SIDEBAR_POSITION you can set a different sidebar position for the examples.
 */
const defaultSidebarPosition = 7;
const sidebarPosition = Number.parseInt(
  `${process.env["DOCS_EXAMPLES_SIDEBAR_POSITION"] ?? defaultSidebarPosition}`,
  10,
);

const rootPath = resolve(__dirname, "../../");
const examplesSourcePath = "pipeline/examples";
const outputDir = join(rootPath, "docs/docs/examples");

async function main() {
  if (!existsSync(outputDir)) {
    await mkdir(outputDir, { recursive: true });
  }
  const [exampleFiles, currentExamples] = await Promise.all([
    glob("*.ts", {
      cwd: join(rootPath, examplesSourcePath),
      ignore: ["*.test.ts"],
    }),
    glob(join(outputDir, "*.md")),
  ]);
  await Promise.all(currentExamples.map((file) => rm(file)));
  const indexFileLines: string[] = [
    `---\nsidebar_position: ${sidebarPosition}\n---\n\n# Config examples\n`,
  ];
  const exampleMdxForSort: {
    outputPath: string;
    content: string;
    title: string;
    indexItem: string;
  }[] = [];
  for (const file of exampleFiles) {
    let title = basename(file, ".ts");
    const path = join(examplesSourcePath, file);
    const absPath = join(rootPath, path);
    const fileName = `${title}.md`;

    const fileContent = await readFile(absPath, { encoding: "utf-8" });
    const cleanedContent = fileContent
      .replaceAll(/import( | type ).+from .+\n+/g, "")
      .replaceAll(/\n+export const information = \{\n.+\n\};\n+/g, "")
      .replaceAll(/\n+export default config;/g, "");

    const mod = require(join(rootPath, examplesSourcePath, title)); // eslint-disable-line @typescript-eslint/no-var-requires
    if ("information" in mod) {
      if ("title" in mod.information) {
        title = mod.information.title;
      }
    }
    const content = await format(
      [
        `<!-- Auto generated with 'yarn workspace docs gen-examples-md'. Do not edit manually -->\n`,
        `# ${title}\n`,
        `[${file}](https://git.panter.ch/catladder/catladder/-/blob/main/${path})\n`,
        `\`\`\`ts`,
        cleanedContent,
        `\`\`\``,
      ].join("\n"),
      { parser: "markdown" },
    );
    exampleMdxForSort.push({
      outputPath: join(outputDir, fileName),
      content,
      title,
      indexItem: `- [${title}](/docs/examples/${basename(fileName, ".md")})`,
    });
  }
  await Promise.all(
    exampleMdxForSort
      .sort((a, b) => a.title.localeCompare(b.title))
      .map(async ({ content, indexItem, outputPath, title }, index) => {
        indexFileLines.push(indexItem);
        await writeFile(
          outputPath,
          `---\nsidebar_position: ${index + 1}\nsidebar_label: '${title}'\n---\n\n${content}`,
        );
      }),
  );
  const indexMd = await format(indexFileLines.join("\n"), {
    parser: "markdown",
  });
  await writeFile(join(outputDir, "index.md"), indexMd);
}

main().catch(console.error);
