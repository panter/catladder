# Catladder documentation site

The [catladder documentation](https://panter.github.io/catladder/), built
with [Docusaurus](https://docusaurus.io/).

## Local development

```sh
pnpm install          # from the repository root
pnpm --filter docs start
```

`start` regenerates the derived pages first and then serves the site with
hot reload.

## Generated pages

Two parts of the site are generated on every build and **gitignored** —
never edit them by hand:

| Output                  | Generated from                    | Script                               |
| ----------------------- | --------------------------------- | ------------------------------------ |
| `docs/examples/`        | `packages/pipeline/examples/*.ts` | `pnpm --filter docs gen-examples-md` |
| `docs/4_agents/skills/` | `skills/`                         | `pnpm --filter docs gen-skills-md`   |

`pnpm --filter docs gen-md` runs both. The example pages come from the
same configs the snapshot tests use, so adding an example adds a test and
a docs page at once.

## Build

```sh
pnpm --filter docs gen-md
pnpm --filter docs build
```

Broken links fail the build (`onBrokenLinks: "throw"`).

## Deployment

The site deploys itself through catladder: the `docs` component in
[`catladder.ts`](../../catladder.ts) uses the `pages` deploy type, so the
main-branch pipeline publishes it to GitHub Pages. There is nothing to
run by hand — merge to `main` and the pipeline does it.
