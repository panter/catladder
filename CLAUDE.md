# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Catladder is a TypeScript framework by Panter that generates GitLab CI/CD pipelines from TypeScript configuration. It automates pipeline generation, cloud deployments (Kubernetes, Cloud Run), and DevOps workflows.

## Repository Structure

**Yarn 3.1.1 monorepo** with three workspaces:

- **`pipeline/`** (`@catladder/pipeline`) — Core framework: pipeline generation, build/deploy types, environment management, agent integration
- **`cli/`** (`@catladder/cli`) — CLI tools: `catladder` (environment/secret management), `catenv` (pipeline/env file generation via direnv)
- **`docs/`** — Docusaurus documentation site

## Common Commands

```bash
# Build all workspaces (topological order, excludes docs)
yarn build

# Watch mode for all workspaces in parallel
yarn dev

# Run tests (generates example tests first, then runs vitest)
yarn test
yarn test:watch
yarn test:update          # update snapshots

# Lint
yarn lint                 # all workspaces
yarn workspace @catladder/pipeline lint:fix
yarn workspace @catladder/cli lint:fix

# Format
yarn pretty

# Run CLIs locally
yarn catenv
yarn catladder
```

### Workspace-specific builds

```bash
yarn workspace @catladder/pipeline build    # tsc + babel variable inlining
yarn workspace @catladder/cli build         # tsc + tsc-alias + ncc bundle
```

## Testing

- **Framework**: Vitest (globals enabled, node environment)
- **Test locations**: `**/__tests__/**/*.[jt]s?(x)` and `pipeline/examples/*.test.ts`
- **Example tests**: Auto-generated from `pipeline/examples/` via `yarn workspace @catladder/pipeline generate:examples-test` — this runs automatically before `yarn test`
- **Snapshots**: Example tests use snapshot testing for generated YAML output; update with `yarn test:update`
- **Timeout**: 10 seconds per test

## Architecture

### Pipeline Generation Flow

1. **Config** (`catladder.ts`) defines components, builds, deploys, agents, environments
2. **Context creation** (`pipeline/src/context/`) builds runtime contexts per component/environment
3. **Job creation** (`pipeline/src/pipeline/createAllJobs.ts`) generates GitLab CI jobs based on pipeline triggers
4. **YAML output** → `.catladder-generated/gitlab/` directory (must be checked in)
5. **GitLab CI** (`.gitlab-ci.yml`) includes generated files

### Key Concepts

- **Pipeline triggers**: `mainBranch` (push to main), `mr` (merge requests), `taggedRelease` (git tags)
- **Environments**: `dev` (mainBranch), `review` (mr), `stage`/`prod` (taggedRelease), `local` (direnv only)
- **Build types**: `node`, `rails`, `base`
- **Deploy types**: `kubernetes`, `cloudRun`, `dockerTag`, `custom`
- **Components**: Each component has a build config and deploy config; multiple components per project

### Key source modules in `pipeline/src/`

- `types/` — Config schema, GitLab CI types, job types, context types
- `pipeline/` — Job creation, pipeline orchestration, GitLab integration
- `build/` — Build strategies (node, rails, base, docker, caching)
- `deploy/` — Deploy strategies (kubernetes, cloudRun, dockerTag, custom)
- `context/` — Runtime context (component context, environment resolution)
- `bash/` — Type-safe bash script generation (`BashExpression`)
- `variables/` — Environment variable handling (`VariableValue`)
- `rules/` — GitLab job rule generation
- `catenv/` — Environment file generation for direnv

### CLI structure (`cli/src/`)

- `apps/cli/` — Commander-based CLI (`catladder` command; command defs in `commands/`, registered in `cli.ts`)
- `apps/catenv/` — Environment/pipeline generation (`catenv` command)

## Agent skills (`skills/`)

`skills/` contains the agent skills catladder ships to consumer
projects: pipeline generation materializes them into `.claude/skills/`
and `.agents/skills/` as `catladder-*` directories, so AI coding agents
working in a consumer repo get usage knowledge matching the installed
catladder version (see `pipeline/src/agentSkills/`).

**When you change user-facing behavior — config options, CLI commands,
generated pipeline behavior, workflows — update the affected skill in
`skills/` in the same change.** The skills are catladder's agent-facing
documentation; a stale skill actively misleads agents in every consumer
project.

`skills/catladder-cli/references/commands.md` is generated from the
command definitions by the cli build (`build:skill-cli-reference`) —
never edit it, rebuild instead and commit the result.

## Code Style

- **TypeScript strict mode** enabled
- **ESLint**: Flat config (v9.x) with `@typescript-eslint/consistent-type-imports` enforced as error — always use `import type` for type-only imports
- **Prettier** for formatting
- **Pre-commit**: Husky + lint-staged runs `eslint --cache --fix` on staged `.ts` files
- `no-unused-vars` and `no-explicit-any` are intentionally disabled
