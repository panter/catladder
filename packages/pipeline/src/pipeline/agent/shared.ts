import {
  escapeBackTicks,
  escapeDoubleQuotes,
  escapeNewlines,
} from "@catladder/bash";
import { getRunnerImage } from "../../runner";
import type { AgentContext, CatladderJobSpec } from "../../types";
import { CatladderJob } from "../../types/jobs";

export abstract class AgentJob extends CatladderJob {
  constructor(
    context: AgentContext,
    def: Pick<CatladderJobSpec, "name" | "rules" | "script"> &
      Partial<
        Pick<
          CatladderJobSpec,
          "envMode" | "interruptible" | "allow_failure" | "variables"
        >
      >,
  ) {
    super({
      interruptible: def.interruptible,
      stage: "agents",

      // image: "node:24-alpine3.21",
      image: getRunnerImage("agent-claude"),
      variables: {
        MAX_MCP_OUTPUT_TOKENS: "75000",
        GITLAB_PERSONAL_ACCESS_TOKEN: "$AGENT_GITLAB_PERSONAL_ACCESS_TOKEN", // TODO: we don't have global secret keys to configure yet
        GITLAB_API_URL: "$CI_API_V4_URL",
        ...def.variables,
      },
      envMode: def.envMode,
      name: def.name,
      allow_failure: def.allow_failure,
      rules: def.rules,
      script: def.script,
    });
  }
}

export const baseSetupScript = [
  // these are done in the image already
  // "apk update",
  // "apk add --no-cache git curl bash",
  //"npm install -g @anthropic-ai/claude-code",
  "claude mcp add gitlab --env GITLAB_PERSONAL_ACCESS_TOKEN=$GITLAB_PERSONAL_ACCESS_TOKEN --env GITLAB_API_URL=$GITLAB_API_URL --env USE_PIPELINE='true' -- npx -y @zereight/mcp-gitlab",
];

export const callClaude = ({ prompt }: { prompt: string }) => {
  return [
    `export PROMPT="${escapeNewlines(
      escapeDoubleQuotes(escapeBackTicks(prompt)),
    )}"`,
    //'echo "$PROMPT"',
    `claude -p "$PROMPT" --permission-mode acceptEdits --allowedTools "Bash Read(*) Edit(*) Write(*) mcp__gitlab" --verbose --debug`,
  ];
};
