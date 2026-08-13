# AI Agents (Experimental)

> **Warning:** AI agents are experimental and currently in development. Features and configuration may change.

Catladder supports AI agents that can automatically perform tasks like code review, issue analysis, and other development workflows. Currently, Claude AI agents are supported.

:::note

Agent jobs are generated for the **GitLab backend only** — they are
skipped on GitHub, which has its own Claude Code app for the same
workflows.

This is separate from the [agent skills](./skills) catladder
materializes into `.claude/skills/` on every generation, which work
regardless of backend and need no configuration.

:::

## Installation

### 1. Configure catladder.ts

Add agent configuration to your `catladder.ts` file:

```typescript
import type { Config } from "@catladder/cli";

const config = {
  appName: "your-app",
  customerName: "your-customer",
  // Note: AI agents are experimental
  agents: {
    claude: {
      type: "claude",
    },
  },
  components: {
    // your components...
  },
} satisfies Config;

export default config;
```

### 2. Run project setup

Provision the infrastructure the agent needs:

```bash
yarn catladder project setup
```

### 3. Manual Environment Variables Setup

Currently, these environment variables need to be set up manually in your GitLab project's CI/CD settings:

#### ANTHROPIC_API_KEY or CLAUDE_CODE_OAUTH_TOKEN

(only needed if group or global variables are not set)

Set your Anthropic API key or Claude Code OAuth token for Claude access in GitLab CI/CD variables:

- Go to your project's **Settings > CI/CD > Variables**
- Add variable: `ANTHROPIC_API_KEY` with your Anthropic API key value or `CLAUDE_CODE_OAUTH_TOKEN` with your Claude Code OAuth token value
- Mark as **Protected** and **Masked**

#### AGENT_GITLAB_PERSONAL_ACCESS_TOKEN

Set a GitLab personal access token for the agent.claude user:

- Go to your project's **Settings > CI/CD > Variables**
- Add variable: `AGENT_GITLAB_PERSONAL_ACCESS_TOKEN` with the token value
- Mark as **Protected** and **Masked**

This token should be created for the `agent.claude` user account and have appropriate permissions for the repositories the agent will interact with.

### 4. Commit and Push

After configuring the environment variables, commit your changes and push to the repository to complete the setup.

## Usage

Once setup is complete, Claude will automatically:

- **Review merge requests**: Provides automated code reviews on all merge requests
- **Respond to mentions**: Tag `@agent.claude` in comments or issues to get responses and assistance
- **Handle assigned issues**: Assign issues directly to `agent.claude` and it will implement solutions or answer questions

### How it works

- **Merge Request Reviews**: Claude automatically reviews all merge requests and provides feedback on code quality, potential issues, and suggestions for improvement
- **Issue Assignment**: When you assign an issue to `agent.claude`, it will analyze the issue and either implement a solution or provide detailed guidance
- **Mention Responses**: Use `@agent.claude` in any comment on merge requests or issues to ask questions or request specific assistance

## Configuration Options

### Claude Agent

```typescript
agents: {
  claude: {
    type: "claude",
    // Additional configuration options will be documented as they become available
  },
}
```

## Troubleshooting

- Ensure both required environment variables are properly set
- Verify the GitLab token has sufficient permissions
- Check that the agent.claude user exists in your GitLab instance
- Confirm your Anthropic API key is valid and has sufficient credits

For additional support, refer to the main troubleshooting guide or contact support.
