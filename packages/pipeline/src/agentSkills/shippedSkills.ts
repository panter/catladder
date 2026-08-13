import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

/**
 * all catladder skills use this prefix; it marks the namespace
 * catladder owns inside the agent skill directories (regeneration may
 * remove stale `catladder-*` skills it generated earlier)
 */
export const AGENT_SKILL_PREFIX = "catladder-";

export type ShippedSkill = {
  /** the skill directory name, e.g. "catladder-config" */
  name: string;
  /** all files of the skill, relative to the skill directory */
  files: Array<{ relativePath: string; content: string }>;
};

/**
 * the directory containing the agent skill definitions shipped with
 * the package (copied into dist at build time; the repository layout
 * is the fallback for development and tests)
 */
export const getShippedSkillsDir = (): string => {
  const candidates = [
    // built pipeline package: dist/agentSkills -> dist/skills
    // bundled cli package (what consumers install): the ncc bundles live
    // in dist/bundles/<name>, so both resolve to dist/bundles/skills
    join(__dirname, "..", "skills"),
    // cli tsc dist (catenv-dev): dist/packages/pipeline/src/agentSkills -> dist/skills
    // repository: packages/pipeline/src/agentSkills -> <root>/skills
    join(__dirname, "..", "..", "..", "..", "skills"),
  ];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) {
    throw new Error("shipped agent skill definitions not found");
  }
  return found;
};

const readFilesRecursively = (
  dir: string,
  relativeTo: string,
): Array<{ relativePath: string; content: string }> =>
  readdirSync(dir)
    .sort()
    .flatMap((entry) => {
      const fullPath = join(dir, entry);
      if (statSync(fullPath).isDirectory()) {
        return readFilesRecursively(fullPath, relativeTo);
      }
      return [
        {
          relativePath: fullPath.slice(relativeTo.length + 1),
          content: readFileSync(fullPath, "utf-8"),
        },
      ];
    });

export const getShippedSkills = (): ShippedSkill[] => {
  const skillsDir = getShippedSkillsDir();
  return readdirSync(skillsDir)
    .sort()
    .filter((entry) => statSync(join(skillsDir, entry)).isDirectory())
    .map((name) => {
      const skillDir = join(skillsDir, name);
      return { name, files: readFilesRecursively(skillDir, skillDir) };
    });
};
