---
sidebar_position: 99
---

# Development

This page is about developing **catladder itself**. For using it in a
project, start with [getting started](./1_getting_started.md).

## Local development

After cloning the repo, run `pnpm install` in the root directory to
install the dependencies. The repo is a
[turborepo](https://turborepo.com/) with two workspaces that matter for
development:

|                     |                                                                 |
| ------------------- | --------------------------------------------------------------- |
| `apps/cli`          | `@catladder/cli` — the `catladder` and `catenv` commands        |
| `packages/pipeline` | the generation framework, compiled into the cli (not published) |

Build everything once with `pnpm build`, or keep a watch build running
with `pnpm dev`.

The executables live in `apps/cli/bin`:

| Executable                     | Runs                                                      |
| ------------------------------ | --------------------------------------------------------- |
| `catladder` / `catenv`         | the bundled build (`dist/bundles/…`) — what consumers get |
| `catladder-dev` / `catenv-dev` | the plain compiled sources (`dist/apps/cli/src/…`)        |

The `-dev` variants skip the bundling step, so a `pnpm dev` watch build
is enough to pick up a change — use them while developing. The bundles
are what `npm publish` ships, so test against those before releasing
anything that touches packaging (shipped assets, dynamic requires).

From the repo root, `pnpm catenv` and `pnpm catladder` run the `-dev`
executables against catladder's own config.

## Development workflow

After adding your changes, run the `-dev` version in a test project. If
you don't have one, create a small throwaway project to test against
(Panter devs: use the internal test-projects group).

Symlink the executable you need somewhere on your `$PATH`:

```bash
sudo ln -s ~/dev/catladder/apps/cli/bin/catladder-dev /usr/local/bin/catladder-dev
```

Then run it in the test project and inspect the generated pipeline diff.

## Snapshot tests

The [examples](/docs/examples) double as snapshot tests: each
`packages/pipeline/examples/*.ts` config is generated for both backends
and compared against a checked-in snapshot, so any change to the
generator shows up as a reviewable diff in the snapshot.

```bash
pnpm test          # run everything
pnpm test:update   # accept changed snapshots
```

Please add more examples there — a new feature without an example is a
feature without a test and without documentation.

## Releasing

Catladder generates its own pipeline and releases itself with the
`changesets` method: user-facing changes merge together with a
`.changeset/*.md` file, and the `🦋 changeset check` job on the pull
request tells you what the next release would look like. See
[releases](./7_releases.md).
