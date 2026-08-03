---
name: authoring-catladder-skills
description: How to author and maintain the agent skills that catladder ships to consumer projects (the `skills/` directory of this repo). Use when adding a new catladder skill, editing an existing SKILL.md, or — importantly — when changing ANY user-facing catladder behavior (a config option, a CLI command, a build/deploy/pipeline/release feature, a generated workflow): that change MUST update the matching skill in the same commit. Triggers on "add a skill", "update the skills", "new SKILL.md", editing files under `skills/`, or changing catladder's public config / CLI / pipeline surface.
---

# Authoring & maintaining catladder's agent skills

This is a **repo-internal** skill: it is for developing catladder
itself and is NOT shipped to consumer projects. The skills that *are*
shipped live in the top-level [`skills/`](../../../skills) directory.

## What the shipped skills are

`skills/<name>/SKILL.md` (+ optional `references/*.md`) are catladder's
agent-facing docs. They are:

- **shipped** inside the `@catladder/cli` package (copied into `dist/`
  by `build:copy-skills`);
- **materialized** into every consumer repo's `.claude/skills/` on every
  `catenv` run (`generateAgentSkills` in `pipeline/src/agentSkills/`), as
  `catladder-*` directories carrying a generated marker. The cross-agent
  `.agents/skills/` location is opt-in
  (`agentSkills: { targets: ["claude-code", "agents"] }`);
- therefore **version-synced for free** — the agent in a project always
  sees skills matching that project's installed catladder version;
- **rendered into the docs site** — `yarn workspace docs gen-skills-md`
  (part of `gen-md`, run on docs start/serve/deploy) generates
  `apps/docs/docs/4_agents/skills/` (gitignored) from `skills/`, one
  page per skill plus references and a TOC index. Keep SKILL.md plain
  CommonMark (the pages are rendered with `format: md`), and note that
  the first part of the `description` (before "Use when") doubles as
  the skill's blurb in the docs TOC.

Current skills: `catladder-config`, `catladder-secrets`,
`catladder-pipelines`, `catladder-cli`, `catladder-builds`,
`catladder-deploys`, `catladder-releases`.

## The maintenance rule (most important)

**Any user-facing change to catladder must update the matching skill in
the same commit.** If you add/change a config option, a CLI command, a
build type, a deploy type, pipeline/caching/release behavior, or a
generated workflow, find the skill that documents it and update it. A
stale skill actively misleads every agent in every consumer repo. This
is also stated in [CLAUDE.md](../../../CLAUDE.md) — this skill is the
detailed how-to.

## Adding a new skill

1. Create `skills/catladder-<topic>/SKILL.md`. The directory name is
   the skill `name`; keep the `catladder-` prefix (it is the namespace
   catladder owns and the marker cleanup relies on).
2. Write the frontmatter — **only `name` and `description`** (see
   below). `name` must equal the directory name.
3. Write a concise body (conventions below).
4. Add a "Related skills" section cross-linking the others, and add a
   back-link from those to the new one.
5. **No registration needed** — `getShippedSkills()` discovers every
   directory under `skills/` automatically, and the build ships it.
6. Regenerate this repo's own dogfood copy and run the checks (below).

## Writing the `description` — the auto-invocation contract

The `description` is the single most important field: agents pick a
skill almost entirely from it. Make it do three jobs:

- **What** the skill covers, in one clause.
- **When to use it** — the situations/tasks that should pull it in.
- **Trigger phrases** — end with `Triggers on "…", "…", …` listing the
  literal words a user or agent is likely to use.

Be specific and generous with terms; a vague description means the
skill never fires. Mirror the style of the existing four skills.

## Body conventions

- Lead with a one-paragraph "what this is / where it comes from".
- State the golden rules up front (e.g. never hand-edit generated
  files; change `catladder.ts` and regenerate).
- Keep it task-oriented and short. Push exhaustive detail into
  `references/<topic>.md` and link to it — the SKILL.md should stay
  scannable.
- Show the non-interactive CLI form for anything an agent should run;
  flag interactive commands (e.g. `project config-secrets`) as
  "ask the user to run this".
- End with "## Related skills".

## Generated reference content

`skills/catladder-cli/references/commands.md` is **generated** from the
Commander command definitions by `build:skill-cli-reference`
(`cli/src/scripts/generateCliSkillReference.ts`, run via `tsx`). Never
hand-edit it. To refresh it after adding/changing a CLI command:

```sh
yarn workspace @catladder/cli build:skill-cli-reference
```

This is the preferred way to keep a skill in sync with code: if a skill
documents something the code already knows (command list, config keys),
generate it from the source of truth instead of hand-maintaining it.

## Never do

- **Never add the generated marker** (`🐱 🔨 generated by catladder …`)
  to a source file in `skills/`. The marker is injected only at
  materialization; a source file that carries it would be treated as
  generated and cleaned up.
- **Never edit the materialized copies** under `.claude/skills/` or
  `.agents/skills/` — they are overwritten on the next `catenv` run.
  Edit `skills/` and regenerate.

## Regenerate, test, commit

```sh
yarn workspace @catladder/cli build      # rebuilds dist + copies skills + CLI ref
yarn dev:own-catenv                      # from cli/: regenerates this repo's .claude/skills
# (or: node cli/bin/catenv-dev from the repo root, after a build)
yarn test                                # includes the agentSkills tests
yarn lint
```

Commit the source skill in `skills/` **and** the regenerated dogfood
copy under `.claude/skills/` together, exactly like any other
generated-file change.

Note: the default target is `claude-code` only, so only the
`.claude/skills/` copy is materialized here (not `.agents/skills/`).

## Candidate topics not yet covered

Good future skills / reference pages (verify against the code before
writing — the notes below reflect the current `feat/agent-skills`
branch):

- **build types in depth** — `node`, `node-static`, `storybook`,
  `meteor`, `custom`, `rails` (+ workspace `builds`); options like
  `docker`, `cache`, `buildCommand`, `startCommand`, `postInstall`,
  rails `cnbBuilder`. Source: `pipeline/src/build/`.
- **deploy types in depth** — `kubernetes`, `google-cloudrun`,
  `dockerTag`, `custom`; helm `values`, Cloud Run services/jobs/
  workerPools, CloudSQL/MongoDB wiring. Source: `pipeline/src/deploy/`.
- **releases & the security-audit gate** — `releases.when`
  (`manual`/`auto`) and `releases.method` (`semantic-release` default,
  or `changesets`); both methods gate on a catci security audit that can
  open an MR and fail the release. Source:
  `pipeline/src/types/release.ts`, `pipeline/src/backends/*/*ReleaseJobs`,
  `cli/src/release/`, `runner-images/`.
- **the `agents` integration** — `agents: { claude: { type: "claude" }}`
  generates event + review jobs on webhook/MR triggers; needs setup of
  trigger tokens, webhooks, and `CLAUDE_CODE_OAUTH_TOKEN` /
  `AGENT_GITLAB_PERSONAL_ACCESS_TOKEN`. Source: `pipeline/src/pipeline/agent/`,
  `cli/.../project/setup/setupAgents.ts`.
- **project setup & cloud provisioning** — `project setup` (access
  tokens, service accounts, IAM, Artifact Registry, k8s namespaces) and
  `project doctor` (drift detection), plus day-2 cloud ops (k8s,
  cloudsql, mongo). Source: `cli/.../project/setup/`, `.../doctor/`.
- **migrating a project between GitLab and GitHub pipelines** —
  `pipelines: { gitlab, github }`, secrets sync, per-backend differences.

## Related

- The shipped skills live in `skills/` (source of truth).
- Implementation: `pipeline/src/agentSkills/` (materialization, marker,
  cleanup, target dirs).
