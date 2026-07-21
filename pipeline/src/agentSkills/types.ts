/**
 * where agent skills get materialized, per agent ecosystem:
 * - claude-code: the Claude Code project skills directory
 * - agents: the cross-agent universal skills directory
 *   (https://agents.md convention, picked up by Cursor, Codex, ...)
 */
export const AGENT_SKILL_TARGET_DIRS = {
  "claude-code": ".claude/skills",
  agents: ".agents/skills",
} as const;

export type AgentSkillTargetName = keyof typeof AGENT_SKILL_TARGET_DIRS;

/**
 * agent skills materialization, see {@link Config.agentSkills}
 */
export type AgentSkillsConfig =
  | boolean
  | {
      /**
       * which agent skill directories to write to.
       * Defaults to all known targets.
       */
      targets?: AgentSkillTargetName[];
    };

export const getAgentSkillTargets = (
  agentSkills: AgentSkillsConfig | undefined,
): AgentSkillTargetName[] => {
  if (agentSkills === false) return [];
  if (agentSkills === true || agentSkills === undefined) {
    return Object.keys(AGENT_SKILL_TARGET_DIRS) as AgentSkillTargetName[];
  }
  return (
    agentSkills.targets ??
    (Object.keys(AGENT_SKILL_TARGET_DIRS) as AgentSkillTargetName[])
  );
};
