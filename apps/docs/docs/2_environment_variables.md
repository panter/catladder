---
sidebar_position: 2
sidebar_label: Env Variables
---

# Environment variables

Environment variables can be declared on a component like this:

```ts title="catladder.ts"
const config = {
  components: {
    app: {
      vars: {
        /**
         * Declare secret env-var names in this array.
         * See the [Managing secrets](#managing-secrets) section.
         */
        secret: ["API_KEY", "GOOGLE_TAG_MANAGER_ID"],
        public: {
          MY_ENV_VAR: "my variable",
          MY_OTHER_VAR: "some value",
          /**
           * You can also reference other variables.
           */
          SOME_VAR: "hello from $MY_OTHER_VAR",
          /**
           * You can reference variables (public and secret)
           * from other components too!
           */
          GRAPHQL_ENDPOINT: "${api:ROOT_URL}/graphql",
        },
      },
      env: {
        local: {},
        review: {},
        dev: false,
        stage: false,
        prod: false,
      },
    },
    api: {}, // Api component config ...
  },
} satisfies Config;
```

## Where to use env-vars

All variables (including secrets) are currently available both on build-time (in the pipeline) and on run-time (unless it's a static deployment).

Locally, you can use `catenv` to get the env-vars in your **_local_** environment. See section on [env-vars in local development][env-vars-section].

It is also possible to generate `.env` files automatically on local development and during build. See the section on [.env files][env-files-section].

## Predefined variables

- **ROOT_URL**: This is the public URL of a component. In **_review_** and **_dev_** environment, this is normally auto-generated depending on the deployment type
- **HOSTNAME**: This is the public host name of a component. In **_review_** and **_dev_** environment, this is normally auto-generated depending on the deployment type
- **PORT**: The port the app should listen to.

Depending on the deploy type[^deploy-type], more variables are available.

[^deploy-type]: **DeployConfigType** is one of "kubernetes", "google-cloudrun", "npmPackage", "pages", "dockerTag", or "custom".

## Managing secrets

Secrets are environment variables that should not be checked into the source code.

### The vault

Secret values live in a **vault** — the readable source of truth that
the catladder CLI edits. CI backends only ever receive mirrored copies
of it.

```ts title="catladder.ts"
const config = {
  secrets: {
    // "gitlab" (default): the gitlab project variables double as the store
    // { type: "bitwarden", collection: "catladder" }: one yaml note per
    // env/component, for projects that need a real secret manager or that
    // have no gitlab project at all
    vault: { type: "bitwarden" },
  },
} satisfies Config;
```

Which vault is configured makes no difference to the commands below.

:::note

With the GitHub backend, secrets cannot be read from the vault at
runtime — they are mirrored into GitHub _environment_ secrets (one
GitHub environment per catladder env). After changing secrets, run
`yarn catladder project secrets-sync-github`.

:::

### The interactive editor

If you added a new key to `secret` or want to change secret values, run:

```sh
yarn catladder project config-secrets
```

This will open up your editor with all environment variables in the YAML format.  
Save this file, close it, and catladder will update the secrets.

```sh
upserting all variables, please wait...

upserting review:app...

changed: API_KEY
skip   : GOOGLE_TAG_MANAGER_ID

✅ review:app
--------------------------------

upserting local:app...

changed: API_KEY
skip   : GOOGLE_TAG_MANAGER_ID

✅ local:app
--------------------------------

done! 😻
```

The editor is selected from your shell's environment variables `$VISUAL` or `$EDITOR`, or falls back to `code` or `vim`. Be careful with `EDITOR=code` - **this will not work correctly**.  
The correct way is `EDITOR="code --wait"`.

### Scoped and non-interactive secrets commands

The commands in this section accept a **scope** argument: `dev:app` (one env of one component), `dev:` (one env, all components), `:app` (all envs of one component — handy for rotating a credential everywhere), or nothing (everything). `--key KEY1,KEY2` narrows to specific secrets; this also works for `project config-secrets`.

Besides the editor flow there are non-interactive commands, suitable for scripts and coding agents:

```sh
# status overview (no values); --check exits non-zero when something is unset
catladder project secrets-list
catladder project secrets-list dev:app --reveal

# set a single secret; value via stdin, --value-file or --value
echo -n "the-value" | catladder project secrets-set dev:app API_KEY
catladder project secrets-set :app API_KEY --value-file value.txt

# bulk edit: dump as yaml, edit, push back (partial documents are fine)
catladder project secrets-pull dev: --out secrets.yml
catladder project secrets-push dev: --file secrets.yml
```

`secrets-push` rejects keys that are not declared in the config and skips untouched `🚨 FILL ME` placeholders, so nothing bogus ends up in the vault.

:::note

catladder makes a copy of old values as a backup; you can restore those manually from the vault if needed.

:::

### Migrating secrets and switching vaults

Use `catladder project secrets-migrate [env:component] --to <vault>` to
copy declared secrets between `gitlab` and `bitwarden`. `--to` is required;
`--from` defaults to the configured vault. Omit the scope to migrate all
environments/components, or use `dev:app`, `dev:` or `:app`. Limit keys
with `--key KEY1,KEY2`.

For Bitwarden, `--from-collection` and `--to-collection` select the source
and destination collections. They default to the configured collection
when the vault type matches, otherwise to `catladder`. Specify `--from
bitwarden` explicitly when using `--from-collection`. Source and target
must be different vaults or collections.

```sh
# preview names and counts without writes or confirmation
pnpm catladder project secrets-migrate --to bitwarden --to-collection catladder --dry-run

# copy after reviewing the plan; --yes skips write confirmation
pnpm catladder project secrets-migrate --to bitwarden --to-collection catladder --yes

# select a source explicitly and migrate one component
pnpm catladder project secrets-migrate :app --from bitwarden --from-collection old --to bitwarden --to-collection new --yes
```

Empty/unset source values and placeholders are skipped, and equal target
values are left alone. Differing target values are conflicts; add
`--overwrite` to replace them with backups. Without `--yes`, writes
require confirmation. `--dry-run` only prints the plan. Output contains
names and counts, never secret values. The command re-reads the target
to verify writes and exits non-zero for failed writes, verification
failures or unresolved conflicts.

The source is never modified. Migration does not change `catladder.ts`
or mirror secrets into CI, so existing CI variables remain untouched.
When GitLab is the target vault, its vault entries are project variables
and are written as part of the copy.

To switch the project to a new vault:

1. With the old `secrets.vault` still configured, preview with `--dry-run`,
   then migrate. Resolve any conflicts/failures before switching.
2. Update `secrets.vault` in `catladder.ts` to the destination, including
   the Bitwarden collection if used. Run `pnpm catenv` and commit the
   configuration and generated files.
3. Re-run `pnpm catladder project setup` to provision hidden deployment
   credentials in the new vault: they are not declared user secrets and
   are not copied by this command. If needed, sync GitHub environment
   secrets separately with `pnpm catladder project secrets-sync-github`.
4. Keep the old vault read-only for rollback. Migration never deletes or
   disables it. To roll back, restore the old `secrets.vault` config;
   remember its values can become stale after changes in the new vault.

## catenv - Env-vars in local development

[catenv-section]: #catenv-env-vars-in-local-development

The `catenv` command can do the following when executed:

- [Create .env files automatically][env-files-section] (recommended)
- [Inject env-vars into the shell][inject-env-vars-section] (legacy)
- [Generate TypeScript `process.env` types][envDTs-section]
- [Generate and update the pipeline files][pipeline-generation-section]

### Setup

Install [@catladder/cli][catladder-cli-npm] in your project, if you don't have the [@catladder/cli][catladder-cli-npm] package installed yet:

[catladder-cli-npm]: https://www.npmjs.com/package/@catladder/cli "catladder-cli on npm"

```sh
$ yarn add -D @catladder/cli
```

It's recommended to use [direnv](https://direnv.net/) to automatically update the catladder environment in your shell with catenv when changes occur in your configuration — see the [`.envrc` in the getting started guide](./1_getting_started.md#direnv).

### Usage

There are two modes that can be configured per component in `catladder.ts`:

- [Creating .env files automatically][env-files-section] (recommended)
- [Injecting environment variables in the shell][inject-env-vars-section] (legacy)

#### .env files

[env-files-section]: #env-files

By default, Catladder writes a `.env` and a `env.d.ts` file to your project.  
You can customize the behaviour of the component in your `catladder.ts` file:

```ts
// ...
  components: {
    api: {
      dotEnv: true, // <-- default
      envDTs: true, // will generate env.d.ts file (also default)
      dir: "api",
```

There are these options for `dotEnv`:

- `true` **_default_**: creates a .env files both locally and during the build job. This is typically required for native apps (e.g. react-native).
- `"local"`: creates a .env file only locally
- `false`: disables creating of a .env file

.env files will never be included in the build artifacts as they may contain secrets.

##### Using .env files

When `dotEnv` is set to `true` or `"local"`, `catenv` will create `.env` files in the component's directory.

- Starting with Node 20, `.env` files can be loaded without third-party tools: `node --env-file=.env my-app.js`
- For earlier Node versions or if you need more control, use [dotenvx][dotenvx]: `yarn run -T dotenvx run my-app.js`
  - Or in combination with [tsx][tsx]: `yarn run -T dotenvx run tsx my-app.ts`
- The older [dotenv][dotenv] is also a viable option, but less convenient.

[dotenvx]: https://github.com/dotenvx/dotenvx "A better dotenv–from the creator of dotenv"
[tsx]: https://github.com/privatenumber/tsx "The easiest way to run TypeScript in Node.js"
[dotenv]: https://github.com/motdotla/dotenv "Loads environment variables from .env for nodejs projects."

#### Injecting env-vars in the shell

[inject-env-vars-section]: #injecting-env-vars-in-the-shell

If dotEnv is set to `false` `catenv` executes `export VARNAME` statements to the shell.  
This is the legacy method to inject env-vars into the local shell.

- Each env-var is exported twice: once with the component name as a prefix and once without.
- This has the downside that if multiple components declare the same env-var, the last one wins and overwrites the previous one.
- It is therefore recommended to migrate to use `.env` files.

example:

```ts
// ...
  components: {
    api: {
      dotEnv: false, // disable .env file creation
      envDTs: true, // still possible to set
      dir: "api",
```

#### Typescript and process.env

[envDTs-section]: #typescript-and-processenv

To get autocompletion in your IDE for `process.env`, `catenv` generates an `env.d.ts` file with type definitions for `process.env`.

You can disable this like this:

```ts
// ...
  components: {
    api: {
      envDTs: false, // disable env.d.ts file generation
      dir: "api",
// ...
```

This will make `catenv` generate an `env.d.ts` file with type definitions for `process.env`.

#### Pipeline generation

[pipeline-generation-section]: #pipeline-generation

Besides the local environment, `catenv` generates the pipeline files
themselves — `.gitlab-ci.yml` plus `.catladder-generated/gitlab/` for
GitLab, `.github/workflows/` for GitHub, depending on what `pipelines`
declares. They are checked into git, so every pipeline change is a
reviewable diff.

Catenv rewrites them whenever your catladder configuration changes, or
when a newer version of [@catladder/cli][catladder-cli-npm] results in a
different pipeline output. With direnv this happens as you enter the
project directory; otherwise run `yarn catenv` (or `direnv reload`)
yourself and commit the result.
