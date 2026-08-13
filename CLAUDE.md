# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Catladder is a TypeScript framework by Panter that generates GitLab CI/CD pipelines from TypeScript configuration. It automates pipeline generation, cloud deployments (Kubernetes, Cloud Run), and DevOps workflows.

## Repository Structure

**pnpm monorepo** orchestrated with **Turborepo** (`turbo run`), workspaces under `packages/*` and `apps/*`:

- **`packages/pipeline`** (`@catladder/pipeline`, private) — Core framework: pipeline generation, build/deploy types, environment management, agent integration. Not published; compiled from source into the cli.
- **`packages/bash`** (`@catladder/bash`, private) — Type-safe bash script generation primitives (`BashExpression`, escaping, `VariableValue`). Internal just-in-time package: `main` points at `src/index.ts`.
- **`apps/cli`** (`@catladder/cli`) — the only published npm package: `catladder` (environment/secret management), `catenv` (pipeline/env file generation via direnv). Its tsc compiles the pipeline+bash sources via tsconfig `paths` + `tsc-alias`, then ncc bundles.
- **`apps/docs`** — Docusaurus documentation site

**pnpm does not hoist**, so every import must be declared in the
package that imports it. Two consequences worth knowing:

- `apps/cli` compiles the `packages/*` **sources** into its own `dist`,
  which then resolves from `apps/cli` — so anything the pipeline
  requires at runtime (`jiti`, `path-equal`, `slugify`, `zod`, …) has to
  be declared in `apps/cli` as well, or `bin/catenv-dev` fails with
  MODULE_NOT_FOUND (the ncc bundle used by the published cli inlines
  everything and hides this).
- a dependency with an install script needs an entry in `allowBuilds`
  in `pnpm-workspace.yaml`, otherwise pnpm silently skips it.

## Common Commands

```bash
# Build all workspaces (turbo graph, cached, excludes docs)
pnpm build

# Watch mode for all workspaces in parallel
pnpm dev

# Run tests (generates example tests first, then runs vitest)
pnpm test
pnpm test:watch
pnpm test:update               # update snapshots

# Lint
pnpm lint                      # all workspaces (turbo run lint)
pnpm exec turbo run lint:fix   # prefer turbo over `pnpm --filter <ws> lint`

# Format
pnpm pretty

# Run CLIs locally
pnpm catenv
pnpm catladder
```

### Workspace-specific builds

```bash
pnpm exec turbo run build --filter=@catladder/pipeline   # tsc + copy runner images
pnpm exec turbo run build --filter=@catladder/cli        # tsc + tsc-alias + ncc bundle (+ deps)
```

## Testing

- **Framework**: Vitest (globals enabled, node environment)
- **Test locations**: `**/__tests__/**/*.[jt]s?(x)` and `packages/pipeline/examples/*.test.ts`
- **Example tests**: Auto-generated from `packages/pipeline/examples/` via `turbo run generate:examples-test` — this runs automatically before `pnpm test`
- **Snapshots**: Example tests use snapshot testing for generated YAML output; update with `pnpm test:update`
- **Editing `runner-images/` changes snapshots**: job images are tagged by a content hash of their definition (see `customImages/`), and that tag is embedded throughout the generated YAML. So **any** edit under `runner-images/` (even a comment) changes the hash and requires `pnpm test:update` + committing the regenerated snapshots — otherwise CI's snapshot test fails on the changed image tag even though nothing behavioural changed.
- **Timeout**: 10 seconds per test

## Architecture

### Pipeline Generation Flow

1. **Config** (`catladder.ts`) defines components, builds, deploys, agents, environments
2. **Context creation** (`packages/pipeline/src/context/`) builds runtime contexts per component/environment
3. **Job creation** (`packages/pipeline/src/pipeline/createAllJobs.ts`) generates GitLab CI jobs based on pipeline triggers
4. **YAML output** → `.catladder-generated/gitlab/` directory (must be checked in)
5. **GitLab CI** (`.gitlab-ci.yml`) includes generated files

### Key Concepts

- **Pipeline triggers**: `mainBranch` (push to main), `mr` (merge requests), `taggedRelease` (git tags)
- **Environments**: `dev` (mainBranch), `review` (mr), `stage`/`prod` (taggedRelease), `local` (direnv only)
- **Build types**: `node`, `rails`, `base`
- **Deploy types**: `kubernetes`, `cloudRun`, `dockerTag`, `custom`
- **Components**: Each component has a build config and deploy config; multiple components per project

### Key source modules in `packages/pipeline/src/`

- `types/` — Config schema, GitLab CI types, job types, context types
- `pipeline/` — Job creation, pipeline orchestration, GitLab integration
- `build/` — Build strategies (node, rails, base, docker, caching)
- `deploy/` — Deploy strategies (kubernetes, cloudRun, dockerTag, custom)
- `context/` — Runtime context (component context, environment resolution)
- `bash/` — pipeline-coupled bash helpers (CI variables per backend); the core primitives (`BashExpression`, `VariableValue`) live in `packages/bash`
- `rules/` — GitLab job rule generation
- `catenv/` — Environment file generation for direnv

### CLI structure (`apps/cli/src/`)

- `apps/cli/` — Commander-based CLI (`catladder` command; command defs in `commands/`, registered in `cli.ts`)
- `apps/catenv/` — Environment/pipeline generation (`catenv` command)

## Agent skills (`skills/`)

`skills/` contains the agent skills catladder ships to consumer
projects: pipeline generation materializes them into `.claude/skills/`
as `catladder-*` directories, so AI coding agents working in a consumer
repo get usage knowledge matching the installed catladder version (see
`packages/pipeline/src/agentSkills/`). The cross-agent `.agents/skills/` location
is opt-in via `agentSkills: { targets: ["claude-code", "agents"] }`.

**When you change user-facing behavior — config options, CLI commands,
generated pipeline behavior, workflows — update the affected skill in
`skills/` in the same change.** The skills are catladder's agent-facing
documentation; a stale skill actively misleads agents in every consumer
project.

`skills/catladder-cli/references/commands.md` is generated from the
command definitions by the cli build (`build:skill-cli-reference`) —
never edit it, rebuild instead and commit the result.

For the full how-to on adding a new skill or updating an existing one
(frontmatter/description conventions, generated references, regenerate +
test + commit), see the repo-internal `authoring-catladder-skills` skill
in `.claude/skills/` (it is not shipped to consumers).

## Code Style

- **TypeScript strict mode** enabled
- **ESLint**: Flat config (v9.x) with `@typescript-eslint/consistent-type-imports` enforced as error — always use `import type` for type-only imports
- **Prettier** for formatting
- **Pre-commit**: Husky + lint-staged runs `eslint --cache --fix` on staged `.ts` files
- `no-unused-vars` and `no-explicit-any` are intentionally disabled
