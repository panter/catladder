import { rm, readFile, writeFile, mkdir } from "fs/promises";
import { join, resolve, basename } from "path";
import { glob } from "glob";
import { format } from "prettier";

/**
 * Renders the agent skills catladder ships to consumer projects
 * (the top-level `skills/` directory) into the docs as
 * docs/4_agents/skills/, one page per skill plus a generated index.
 * The output directory is gitignored — regenerate with
 * 'yarn workspace docs gen-skills-md'.
 */

const rootPath = resolve(__dirname, "../../../");
const skillsSourcePath = "skills";
const outputDir = join(rootPath, "apps/docs/docs/4_agents/skills");

const generatedNotice = (sourcePath: string) =>
  `<!-- Auto generated with 'yarn workspace docs gen-skills-md' from ${sourcePath}. Do not edit manually -->\n`;

// `format: md` opts the generated pages out of MDX parsing — the skills
// are plain CommonMark and may contain text (e.g. `<command>`) that MDX
// would reject.
const frontmatter = (fields: Record<string, string | number>) =>
  [
    "---",
    ...Object.entries(fields).map(([k, v]) => `${k}: ${v}`),
    "---",
    "",
  ].join("\n");

const parseSkillMd = (content: string) => {
  const match = content.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) {
    throw new Error("SKILL.md has no frontmatter");
  }
  const description = match[1].match(/^description:\s*(.+)$/m)?.[1];
  if (!description) {
    throw new Error("SKILL.md frontmatter has no description");
  }
  return { description, body: content.slice(match[0].length).trimStart() };
};

// The descriptions follow the "<what it covers>. Use when <...>.
// Triggers on <...>." convention — only the first part is meant for
// human readers, the rest is agent trigger wording.
const humanDescription = (description: string) =>
  description.split(/\s+Use when\s|\s+Triggers?\s+on\s/)[0].trim();

// Docusaurus only infers the title from a `# h1` at the very start of
// the content — our generated notice comes first, so pass the h1 as
// explicit frontmatter title instead.
const extractTitle = (markdown: string) => {
  const title = markdown.match(/^#[ \t]+(.+)$/m)?.[1];
  if (!title) {
    throw new Error("markdown has no h1 title");
  }
  return JSON.stringify(title);
};

async function main() {
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });

  const skillDirs = (
    await glob("*/SKILL.md", { cwd: join(rootPath, skillsSourcePath) })
  )
    .map((file) => basename(join(file, "..")))
    .sort((a, b) => a.localeCompare(b));

  const indexLines: string[] = [];
  for (let index = 0; index < skillDirs.length; index++) {
    const skillName = skillDirs[index];
    const skillDir = join(skillsSourcePath, skillName);
    const { description, body } = parseSkillMd(
      await readFile(join(rootPath, skillDir, "SKILL.md"), {
        encoding: "utf-8",
      }),
    );

    await mkdir(join(outputDir, skillName), { recursive: true });
    await writeFile(
      join(outputDir, skillName, "index.md"),
      [
        frontmatter({
          sidebar_position: index + 1,
          sidebar_label: `'${skillName}'`,
          title: extractTitle(body),
          format: "md",
        }),
        generatedNotice(join(skillDir, "SKILL.md")),
        body,
      ].join("\n"),
    );

    // references/*.md are linked from the SKILL.md with relative paths,
    // so they keep the same layout next to the generated page
    const referenceFiles = await glob("references/*.md", {
      cwd: join(rootPath, skillDir),
    });
    for (const referenceFile of referenceFiles) {
      await mkdir(join(outputDir, skillName, "references"), {
        recursive: true,
      });
      const referenceContent = await readFile(
        join(rootPath, skillDir, referenceFile),
        { encoding: "utf-8" },
      );
      await writeFile(
        join(outputDir, skillName, referenceFile),
        [
          frontmatter({
            title: extractTitle(referenceContent),
            format: "md",
          }),
          generatedNotice(join(skillDir, referenceFile)),
          referenceContent,
        ].join("\n"),
      );
    }

    indexLines.push(
      `- [${skillName}](./${skillName}/index.md) — ${humanDescription(description)}`,
    );
  }

  const indexMd = await format(
    [
      generatedNotice(skillsSourcePath),
      "# Agent skills",
      "",
      "catladder ships a set of [agent skills](https://code.claude.com/docs/en/skills)",
      "— markdown guides that teach AI coding agents how to work with a",
      "catladder project. Pipeline generation materializes them into the",
      "consumer repo's `.claude/skills/` directory (and, opt-in via",
      '`agentSkills: { targets: ["claude-code", "agents"] }`, into the',
      "cross-agent `.agents/skills/` location), so agents always see the",
      "documentation matching the installed catladder version.",
      "",
      "The skills are plain markdown and just as useful for human readers —",
      "these are the skills shipped with this version:",
      "",
      ...indexLines,
    ].join("\n"),
    { parser: "markdown" },
  );
  await writeFile(
    join(outputDir, "index.md"),
    [
      frontmatter({
        sidebar_label: "'Agent skills'",
        title: '"Agent skills"',
        format: "md",
      }),
      indexMd,
    ].join("\n"),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
