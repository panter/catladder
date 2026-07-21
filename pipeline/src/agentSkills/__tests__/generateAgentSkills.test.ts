import { mkdtemp, mkdir, readFile, readdir, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { beforeEach, describe, expect, it } from "vitest";
import { createCatenvContext } from "../../catenv";
import type { Config } from "../../types";
import {
  AGENT_SKILL_GENERATED_MARKER,
  generateAgentSkills,
  injectGeneratedMarker,
} from "../generateAgentSkills";
import { AGENT_SKILL_PREFIX, getShippedSkills } from "../shippedSkills";

const baseConfig = {
  appName: "test-app",
  customerName: "tst",
  components: {},
} satisfies Config;

const createContext = (config: Partial<Config> = {}) =>
  createCatenvContext({ ...baseConfig, ...config });

describe("shipped skills", () => {
  it("every skill is namespaced and has a valid SKILL.md", () => {
    const skills = getShippedSkills();
    expect(skills.length).toBeGreaterThan(0);
    for (const skill of skills) {
      expect(skill.name).toMatch(new RegExp(`^${AGENT_SKILL_PREFIX}`));
      const skillMd = skill.files.find((f) => f.relativePath === "SKILL.md");
      expect(skillMd, `${skill.name} must contain a SKILL.md`).toBeDefined();
      // frontmatter with the fields agents use for discovery
      expect(skillMd!.content).toMatch(/^---\n/);
      expect(skillMd!.content).toMatch(/\nname: /);
      expect(skillMd!.content).toMatch(/\ndescription: /);
    }
  });
});

describe("injectGeneratedMarker", () => {
  it("inserts the marker after the frontmatter", () => {
    const result = injectGeneratedMarker("---\nname: foo\n---\n\n# Body\n");
    expect(result).toBe(
      `---\nname: foo\n---\n\n${AGENT_SKILL_GENERATED_MARKER}\n\n# Body\n`,
    );
  });

  it("prepends the marker when there is no frontmatter", () => {
    expect(injectGeneratedMarker("# Body\n")).toBe(
      `${AGENT_SKILL_GENERATED_MARKER}\n\n# Body\n`,
    );
  });
});

describe("generateAgentSkills", () => {
  let rootDir: string;

  beforeEach(async () => {
    rootDir = await mkdtemp(join(tmpdir(), "catladder-agent-skills-"));
  });

  it("materializes all shipped skills into all targets by default", async () => {
    await generateAgentSkills(createContext(), rootDir);
    const shipped = getShippedSkills().map((s) => s.name);
    for (const targetDir of [".claude/skills", ".agents/skills"]) {
      expect((await readdir(join(rootDir, targetDir))).sort()).toEqual(shipped);
    }
    const skillMd = await readFile(
      join(rootDir, ".claude/skills", shipped[0], "SKILL.md"),
      "utf-8",
    );
    expect(skillMd).toContain(AGENT_SKILL_GENERATED_MARKER);
    // the marker must not break frontmatter parsing
    expect(skillMd).toMatch(/^---\n/);
  });

  it("removes previously generated skills when opting out", async () => {
    await generateAgentSkills(createContext(), rootDir);
    await generateAgentSkills(createContext({ agentSkills: false }), rootDir);
    expect(await readdir(join(rootDir, ".claude/skills"))).toEqual([]);
    expect(await readdir(join(rootDir, ".agents/skills"))).toEqual([]);
  });

  it("removes stale copies when narrowing targets", async () => {
    await generateAgentSkills(createContext(), rootDir);
    await generateAgentSkills(
      createContext({ agentSkills: { targets: ["claude-code"] } }),
      rootDir,
    );
    expect(
      (await readdir(join(rootDir, ".claude/skills"))).length,
    ).toBeGreaterThan(0);
    expect(await readdir(join(rootDir, ".agents/skills"))).toEqual([]);
  });

  it("never touches user-owned skills, even with a catladder- prefix", async () => {
    const userSkill = join(rootDir, ".claude/skills/catladder-mine");
    await mkdir(userSkill, { recursive: true });
    await writeFile(join(userSkill, "SKILL.md"), "---\nname: mine\n---\n");
    const otherSkill = join(rootDir, ".claude/skills/my-skill");
    await mkdir(otherSkill, { recursive: true });
    await writeFile(join(otherSkill, "SKILL.md"), "---\nname: other\n---\n");

    await generateAgentSkills(createContext(), rootDir);
    await generateAgentSkills(createContext({ agentSkills: false }), rootDir);

    expect(existsSync(join(userSkill, "SKILL.md"))).toBe(true);
    expect(existsSync(join(otherSkill, "SKILL.md"))).toBe(true);
  });
});
