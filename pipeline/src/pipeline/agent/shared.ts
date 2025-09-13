import {
  escapeBackTicks,
  escapeDoubleQuotes,
  escapeNewlines,
} from "../../bash/bashEscape";
import type { AgentContext, CatladderJob } from "../../types";

export const createBaseAgentJob = (
  context: AgentContext,
): Omit<CatladderJob, "name" | "rules" | "script"> => ({
  stage: "agents",
  envMode: "none",
  image: "node:24-alpine3.21",
  variables: {
    MAX_MCP_OUTPUT_TOKENS: "75000",
    GITLAB_PERSONAL_ACCESS_TOKEN: "$AGENT_GITLAB_PERSONAL_ACCESS_TOKEN", // TODO: we don't have global secret keys to configure yet
    GITLAB_API_URL: "$CI_API_V4_URL",
  },
});

export const baseSetupScript = [
  "apk update",
  "apk add --no-cache git curl bash",
  "npm install -g @anthropic-ai/claude-code",
  "claude mcp add gitlab --env GITLAB_PERSONAL_ACCESS_TOKEN=$GITLAB_PERSONAL_ACCESS_TOKEN --env GITLAB_API_URL=$GITLAB_API_URL --env USE_PIPELINE='true' -- npx -y @zereight/mcp-gitlab",
];

export const callClaude = ({ prompt }: { prompt: string }) => {
  return [
    `export PROMPT="${escapeNewlines(
      escapeDoubleQuotes(escapeBackTicks(prompt)),
    )}"`,
    //'echo "$PROMPT"',
    `claude -p "$PROMPT" --permission-mode acceptEdits --allowedTools "Bash(*) Read(*) Edit(*) Write(*) mcp__gitlab" --verbose --debug`,
  ];
};
