# Catladder 🐱🪜

**Your whole CI/CD pipeline, generated from one TypeScript file.**

Catladder turns a single typed config — `catladder.ts` — into complete, committed
pipelines for **GitLab CI and GitHub Actions**: build, test, review apps per
merge/pull request, cloud deployments, post-deploy verification, and releases.
Change the config, regenerate, commit. Never hand-edit CI YAML again.

Built and battle-tested by [Panter](https://www.panter.ch) across its projects;
open source since v5.

📚 **[Documentation](https://panter.github.io/catladder/docs/getting_started)**

```ts
// catladder.ts
import type { Config } from "@catladder/cli";

const config: Config = {
  appName: "my-app",
  customerName: "acme",
  pipelines: { github: true }, // and/or gitlab — both at once during a migration
  releases: { when: "auto", method: "changesets" },
  components: {
    www: {
      dir: "apps/www",
      build: { type: "node" },
      deploy: { type: "google-cloudrun", /* … */ },
      env: { review: {}, dev: {}, prod: {} },
    },
  },
};
export default config;
```

`yarn catenv` generates everything from it — the generated files are checked in,
so every pipeline change is a reviewable diff.

## What you get

- **Two CI backends, one config** — GitLab CI and GitHub Actions from the same
  `catladder.ts`; run both in parallel to migrate between them step by step
  (there is a guided migration skill for exactly that)
- **Environments built in** — `review` (one app per MR/PR, auto-stopped),
  `dev` (main branch), `stage`/`prod` (tagged releases), `local` (direnv:
  `.env` files and pipelines regenerate as you `cd` into the project)
- **Deploy types** — Google Cloud Run (services, jobs, worker pools, Cloud SQL,
  scheduled executions), Kubernetes (Helm), npm packages (with trusted
  publishing/OIDC on GitHub — no stored token), GitLab/GitHub Pages, docker
  tags, or fully custom
- **Build types** — node (yarn/pnpm autodetected, monorepo workspace builds,
  turbo-aware caching), rails, meteor, custom Dockerfiles
- **Releases as a feature, not a bash script** — `semantic-release`
  (conventional commits) or `changesets` (intentional, reviewed release notes),
  both gated on a dependency **security audit**; release queueing ("click any
  time, releases when green"), force-release escape hatch, MR/PR changeset
  check with sticky comments
- **Job images, content-addressed** — CI jobs run in images built in your own
  registry, rebuilt only when their definition changes; declare project-specific
  images (e.g. a pinned Playwright) right in the config
- **Secrets with a source of truth** — a vault (GitLab variables or Bitwarden)
  holds the values; CI backends only ever get mirrored copies
  (`secrets-sync-github`), and `.env` files for local development come from the
  same declarations
- **Merge gating on GitHub** — a generated `catladder ✅` aggregate check plus
  `project setup` gives GitHub what GitLab ships built in: merges that wait for
  the pipeline
- **A doctor** — `catladder project doctor` compares the config against the
  actually provisioned infrastructure (IAM, secrets, environments, merge
  gating) and prints the command that heals each finding
- **AI-agent ready** — generation materializes agent skills into
  `.claude/skills/`, so coding agents in consumer repos know how to work with
  catladder; every CLI command is non-interactively scriptable

## Getting started

```bash
yarn add -D @catladder/cli
# write catladder.ts (see the getting-started guide), then:
yarn catenv                   # generate pipelines, commit the result
yarn catladder project setup  # provision tokens, cloud resources, merge gating
```

See the [getting started guide](https://panter.github.io/catladder/docs/getting_started)
for the full walkthrough, and the docs for build/deploy references, releases,
secrets, and troubleshooting.

## Repository layout

| | |
|---|---|
| [`apps/cli`](apps/cli) | **`@catladder/cli`** on npm — the `catladder` and `catenv` commands |
| [`packages/pipeline`](packages/pipeline) | the generation framework (compiled into the cli, not published) |
| [`apps/docs`](apps/docs) | the documentation site |
| [`runner-images/`](runner-images) | definitions of the job images |
| [`skills/`](skills) | agent skills shipped with the cli |

Catladder generates its own pipeline from [`catladder.ts`](catladder.ts) —
releases here are cut with the `changesets` method, npm publishing runs on
trusted publishing, and the docs deploy to GitHub Pages. Dogfood or it didn't
happen.

## Contributing

Issues and feature requests: [github.com/panter/catladder/issues](https://github.com/panter/catladder/issues).
User-facing changes merge together with a changeset (`.changeset/*.md`) — the
`🦋 changeset check` on your PR will tell you.

## License

MIT
