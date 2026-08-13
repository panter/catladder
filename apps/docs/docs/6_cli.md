---
sidebar_position: 6
---

# CLI

The `catladder` CLI provides commands for managing environments, deployments, secrets, and DevOps workflows.

## Usage

```bash
catladder <command> [options]
```

### Global options

| Option          | Description                   |
| --------------- | ----------------------------- |
| `-y, --yes`     | Skip all confirmation prompts |
| `-V, --version` | Show version                  |
| `-h, --help`    | Show help                     |

### Non-interactive mode

Every command input can be passed as a CLI flag to skip interactive prompts:

```bash
# Interactive: prompts for pod, local port, remote port
catladder project port-forward dev:web

# Non-interactive: all inputs provided
catladder project port-forward dev:web --pod-name=web-abc --local-port=3000 --remote-port=3000
```

You can also pass inputs as JSON:

```bash
catladder project port-forward dev:web --inputs='{"podName":"web-abc","localPort":3000,"remotePort":3000}'
```

### Shell completions

Install zsh completions:

```bash
catladder completion install
```

This adds an eval line to your `~/.zshrc`. Restart your shell or run `source ~/.zshrc`.

To remove:

```bash
catladder completion uninstall
```

You can also manually add completions to your `.zshrc`:

```bash
eval "$(catladder completion zsh)"
```

Completions work for command names, flags, and dynamic values (like environment:component pairs).

## Command reference

The complete list of commands, their inputs and flags is generated from
the command definitions:
[catladder command reference](./4_agents/skills/catladder-cli/references/commands.md).

`catladder --help` and `catladder <group> --help` print the same
information for the installed version.

## Programmatic usage

Commands can be called from code:

```typescript
import { commandPortForward } from "@catladder/cli/commands";
import { runCommand } from "@catladder/cli/core";

await runCommand(commandPortForward, {
  inputs: {
    envComponent: "dev:web",
    podName: "web-abc",
    localPort: 3000,
    remotePort: 3000,
  },
});
```

## Defining commands

:::note

This section is for people working on catladder itself — see
[development](./development.md).

:::

Commands are defined with `defineCommand`:

```typescript
import { defineCommand } from "@catladder/cli/core";

export const myCommand = defineCommand({
  name: "my-command",
  description: "Does something useful",
  group: "project",
  inputs: {
    envComponent: {
      type: "string",
      message: "environment:component",
      positional: true,
      choices: async () => getAvailableEnvComponents(),
    },
    podName: {
      type: "string",
      message: "Which pod?",
      choices: async (ctx) => getPodNames(await ctx.get("envComponent")),
    },
    localPort: {
      type: "number",
      message: "Local port:",
      default: 3000,
    },
  },
  execute: async (ctx) => {
    const env = await ctx.get("envComponent");
    const pod = await ctx.get("podName");
    const port = await ctx.get("localPort");

    ctx.log(`Connecting to ${pod} on port ${port}...`);

    if (await ctx.confirm("Are you sure?")) {
      // do the work
    }
  },
});
```

### Input types

| Type         | Description      | Interactive UI                                                |
| ------------ | ---------------- | ------------------------------------------------------------- |
| `"string"`   | Text value       | Text input, or list selection if `choices` is provided        |
| `"string[]"` | Array of strings | Comma-separated input, or checkboxes if `choices` is provided |
| `"number"`   | Numeric value    | Number input                                                  |
| `"boolean"`  | True/false       | Confirm (yes/no)                                              |

### Input options

| Option       | Description                                                                                  |
| ------------ | -------------------------------------------------------------------------------------------- |
| `type`       | Value type (`"string"`, `"number"`, `"boolean"`, `"string[]"`)                               |
| `message`    | Prompt message shown in interactive mode                                                     |
| `positional` | If true, can be passed as a positional argument                                              |
| `default`    | Default value when not provided                                                              |
| `choices`    | Async function returning available choices. Receives `ctx` so it can depend on other inputs. |

### Context methods

| Method                 | Description                                                |
| ---------------------- | ---------------------------------------------------------- |
| `ctx.get(name)`        | Get an input value. Prompts interactively if not provided. |
| `ctx.log(message)`     | Output a message                                           |
| `ctx.confirm(message)` | Ask for confirmation. Skipped with `--yes`.                |
