---
sidebar_position: 2
sidebar_label: Env Variables
---

# Environment variables

Environment variables can be declared on a component like this:

```ts title="catladder.ts"
const config: Config = {
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
};
```

## Where to use env-vars

All variables (including secrets) are currently available both on build-time (in the pipeline) and on run-time (unless it's a static deployment).

Locally, you can use `catenv` to get the env-vars in your **_local_** environment. See section on [env-vars in local development][env-vars-section].

It is also possible to generate `.env` files automatically on local development and during build. See the section on [.env files][env-files-section].

## Predefined variables

- **ROOT_URL**: This is the public URL of a component. In **_review_** and **_dev_** environment, this is normally auto-generated depending on the deployment type
- **PORT**: The port the app should listen to.

Depending on the deploy type[^deploy-type], more variables are available.

[^deploy-type]: **DeployConfigType** is one of "kubernetes", "google-cloudrun", "dockerTag", or "custom".

## Managing secrets

Secrets are environment variables that should not be checked into the source code.

:::warning

Secrets are currently stored in GitLab. This may not be suitable for super-high-security cases.

:::


If you added a new key to `secrets` or want to change secrets, open a terminal and invoke `yarn catladder` (or just `catladder` if installed globally):

```sh title="catladder shell"
$ yarn catladder

╔══════════════════════════╗
║                          ║
║ catladder 😻 v1.xxx.x ✨ ║
║                          ║
╚══════════════════════════╝

project: project-name
customer: dem

catladder $ project-config-secrets

```

:::tip

The catladder shell supports tab completion, and you can call `help` at any time.

:::

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

catladder $
```

The editor is selected from your shell's environment variables `$VISUAL` or `$EDITOR`, or falls back to `code` or `vim`. Be careful with `EDITOR=code` - **this will not work correctly**.  
The correct way is `EDITOR="code --wait"`.

:::note

catladder makes a copy of old values as a backup; you can restore those manually in GitLab if needed.

:::

## catenv - Env-vars in local development

[catenv-section]: #catenv-env-vars-in-local-development

The `catenv` command can do the following when executed:

- [Create .env files automatically][env-files-section] (recommended)
- [Inject env-vars into the shell][inject-env-vars-section] (legacy)
- [Generate TypeScript `process.env` types][envDTs-section]
- [Generate and update a local GitLab-CI pipeline][local-gitlab-ci-section]

### Setup

Install [@catladder/cli][catladder-cli-npm] in your project, if you don't have the [@catladder/cli][catladder-cli-npm] package installed yet:

[catladder-cli-npm]: https://www.npmjs.com/package/@catladder/cli "catladder-cli on npm"

```sh
$ yarn add -D @catladder/cli
```

It's recommended to use [direnv][direnv] to automatically update the catladder environment in your shell with catenv when changes occur in your configuration.
For this, you need to [install direnv first][direnv-install].

[direnv][direnv] requires a project configuration file `.envrc` in your project root:

```sh title=".envrc"
# Add “node_modules/.bin” to $PATH. You to use catladder without yarn.
layout node
# If catenv is available, invoke it.
if command -v 'catenv' >/dev/null; then
  echo "using catenv"
  watch_file catladder*
  # This will also interpret the output of catenv,
  # which is used to inject env-vars into the current shell.
  eval "$(catenv)"
  # Loads .env file if it exists in your shell
  dotenv_if_exists .env
fi
```

[direnv][direnv] requires you to allow its config changes by calling `direnv allow` in the project root.

[direnv]: https://direnv.net/ "unclutter your .profile"
[direnv-install]: https://direnv.net/docs/installation.html "direnv installation instructions"

### Usage

There are two modes that can be configured per component in `catladder.ts`:

- [Creating .env files automatically][env-files-section] (recommended)
- [Injecting environment variables in the shell][inject-env-vars-section] (legacy)

#### .env files

[env-files-section]: #env-files

To use `.env` files, set `dotEnv: true` on the component in your `catladder.ts` file:

```ts
// ...
  components: {
    api: {
      dotEnv: true, // <--
      envDTs: true, // not mandatory, but recommended, see below
      dir: "api",
```

There are two options for `dotEnv`:

- `true`: creates a .env files both locally and during the build job. This is typically required for native apps (e.g. react-native).
- `"local"`: creates a .env file only locally

.env files will never be included in the build artifacts as they may contain secrets.

##### Using .env files

When `dotEnv` is set to `"local"`, `catenv` will create `.env` files in the component's directory.

- Starting with Node 20, `.env` files can be loaded without third-party tools: `node -env-file=.env my-app.js`
- For earlier Node versions or if you need more control, use [dotenvx][dotenvx]: `yarn run -T dotenvx run my-app.js`
  - Or in combination with [tsx][tsx]: `yarn run -T dotenvx run tsx my-app.ts`
- The older [dotenv][dotenv] is also a viable option, but less convenient.

[dotenvx]: https://github.com/dotenvx/dotenvx "A better dotenv–from the creator of dotenv"
[tsx]: https://github.com/privatenumber/tsx "The easiest way to run TypeScript in Node.js"
[dotenv]: https://github.com/motdotla/dotenv "Loads environment variables from .env for nodejs projects."

#### Injecting env-vars in the shell

[inject-env-vars-section]: #injecting-env-vars-in-the-shell

By default, `catenv` executes `export VARNAME` statements to the shell.  
This is the legacy method to inject env-vars into the local shell.

- Each env-var is exported twice: once with the component name as a prefix and once without.
- This has the downside that if multiple components declare the same env-var, the last one wins and overwrites the previous one.
- It is therefore recommended to migrate to `.env` files.

#### Typescript and process.env

[envDTs-section]: #typescript-and-processenv

To get autocompletion in your IDE for `process.env`, set `envDTs` to `true` on the component:

```ts
// ...
  components: {
    api: {
      envDTs: true, // <--
      dir: "api",
// ...
```

This will make `catenv` generate an `env.d.ts` file with type definitions for `process.env`.

#### Local GitLab-CI pipeline generation

[local-gitlab-ci-section]: #local-gitlab-ci-pipeline-generation

Since catladder 1.145.0, you can generate a `.gitlab-ci.yml` config file locally and commit it with git.

:::note

By default, catladder starts a GitLab-CI job that will generate a `__pipeline.yml` each time the CI pipeline starts, and run this pipeline then as a child pipeline.

:::
##### Migrate project to local GitLab pipeline

First, you need to install the [@catladder/cli][catladder-cli-npm] package and remove the [@catladder/pipeline][catladder-pipeline-npm] package:

[catladder-pipeline-npm]: https://www.npmjs.com/package/@catladder/pipeline "catladder-pipeline on npm"

```sh
$ yarn remove @catladder/pipeline
$ yarn add -D @catladder/cli
```

You need to fix the imports of [@catladder/pipeline][catladder-pipeline-npm] to [@catladder/cli][catladder-cli-npm] in your `catladder.ts` file (and elsewhere).  
Additionally, you need to set the `pipelineType`.

```ts title="catladder.ts"
import type { Config } from "@catladder/cli";

const config: Config = {
  appName: "my-app",
  appName: "dem",
  pipelineType: "gitlab",
  components: {
    // Your components config ...
  },
};

export default config;
```

Now you can run `direnv reload` (or run `catenv` manually) to generate the `.gitlab-ci.yml` file.

Catenv will now update your `.gitlab-ci.yml` file whenever your catladder configuration changes, or a newer version of [@catladder/cli][catladder-cli-npm] results in a different pipeline output.
