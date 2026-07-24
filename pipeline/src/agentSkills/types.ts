/**
 * where agent skills get materialized, per agent ecosystem:
 * - claude-code: the Claude Code project skills directory (the default)
 * - agents: the cross-agent universal skills directory
 *   (https://agents.md convention). Opt-in — as of now no widely-used
 *   agent reads `.agents/skills/`; a repo that wants cross-agent
 *   discovery can also just symlink `.agents/skills` → `.claude/skills`
 *   once itself instead of enabling this target.
 */
export const AGENT_SKILL_TARGET_DIRS = {
  "claude-code": ".claude/skills",
  agents: ".agents/skills",
} as const;

export type AgentSkillTargetName = keyof typeof AGENT_SKILL_TARGET_DIRS;

/**
 * the target(s) written when `agentSkills` does not name any explicitly.
 * Claude Code is the only agent that consumes these skills today, so we
 * default to it alone rather than duplicating every skill into
 * `.agents/skills/` (extra committed files + diff noise on every run).
 */
export const DEFAULT_AGENT_SKILL_TARGETS: AgentSkillTargetName[] = [
  "claude-code",
];

/**
 * agent skills materialization, see {@link Config.agentSkills}
 */
export type AgentSkillsConfig =
  | boolean
  | {
      /**
       * which agent skill directories to write to.
       * Defaults to {@link DEFAULT_AGENT_SKILL_TARGETS} (`claude-code`).
       */
      targets?: AgentSkillTargetName[];
    };

export const getAgentSkillTargets = (
  agentSkills: AgentSkillsConfig | undefined,
): AgentSkillTargetName[] => {
  if (agentSkills === false) return [];
  if (agentSkills === true || agentSkills === undefined) {
    return [...DEFAULT_AGENT_SKILL_TARGETS];
  }
  return agentSkills.targets ?? [...DEFAULT_AGENT_SKILL_TARGETS];
};
