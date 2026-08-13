---
sidebar_position: 1
---

# Getting started

Catladder turns one typed config file — `catladder.ts` — into a complete
CI/CD pipeline for **GitLab CI, GitHub Actions, or both at once**.

## Install

1. Install the catladder CLI: `yarn add -D @catladder/cli`
   (or `pnpm add -D @catladder/cli` — catladder autodetects the package manager)
1. Create the file `catladder.ts` in your repository root
1. Declare which pipelines to generate under `pipelines`

```ts title="catladder.ts"
import type { Config } from "@catladder/cli";

const config = {
  appName: "example-app",
  customerName: "pan",
  // generate gitlab ci, github actions, or both — running both in
  // parallel is how you migrate from one to the other
  pipelines: { gitlab: true },
  components: {},
} satisfies Config;

export default config;
```

:::note

`pipelineType: "gitlab"` is the deprecated predecessor of `pipelines`.
Existing projects that set it keep working, but new projects should use
`pipelines`.

:::

### Generate the pipeline

`catenv` generates the pipeline files from the config:

- **GitLab**: `.gitlab-ci.yml` plus the job definitions in `.catladder-generated/gitlab/`
- **GitHub**: the workflows in `.github/workflows/`

```sh
yarn catenv
```

**Check the generated files into git.** Catladder never generates
pipelines on the fly in CI — every pipeline change is a reviewable diff
in your merge request.

#### Direnv

With [direnv][direnv-install], catenv runs automatically whenever the
config changes and you enter the project directory.
Add the following to your `.envrc`:

```sh title=".envrc"
layout node # puts node_modules/.bin on $PATH, so catenv works without yarn

if command -v 'catenv' >/dev/null; then
  watch_file catladder.ts
  echo "using catenv"
  # generates the pipeline files and the local .env files;
  # eval is only needed if you rely on exported env vars (see env vars chapter)
  eval "$(catenv)"
  dotenv_if_exists .env # loads the generated .env file into your shell
fi
```

[direnv][direnv] requires you to allow its config changes by calling
`direnv allow` in the project root.

### Provision the infrastructure

Generating the pipeline does not create anything in the cloud. Once your
components have a deploy config, run:

```sh
yarn catladder project setup
```

This provisions what the config implies: CI tokens, service accounts and
their IAM roles, enabled google APIs, artifact registries — and, on
GitHub, the merge gating that makes pull requests wait for the pipeline.
Run it again whenever the config changes what infrastructure is needed.

For google cloud deployments you need the gcloud CLI:

1. Install it: https://cloud.google.com/sdk/docs/install-sdk
1. Authenticate: `gcloud auth login`

To check later whether the provisioned state still matches the config,
use [`catladder project doctor`](./5_troubleshooting.md).

### The configuration

`catladder.ts` is the central configuration for your project.  
You can use TypeScript to get full advantage of type checking in this configuration (YAML is also supported, but not recommended).

The configuration's basic structure looks like this:

```ts title="catladder.ts" showLineNumbers
import type { Config } from '@catladder/cli'

const config = {
   appName: "my-first-app",
   customerName: "pan", // copy three letters from controllr project (e.g. pan, wea, wpa, sss, ...)
   components: {
      www: {
        dir: "frontend"
        ....
      },
      api: {
        dir: "api",
        ...
      },
      admin: {
        ...
      },
      myOtherComponent: {
        ...
      }
   }
} satisfies Config;

export default config
```

### Components

A `Component` is one subapp/service/piece of your application. E.g. in a typical app with frontend and API, both the frontend and the API would be a `Component` in catladder.  
Each `Component` is usually one deployment and one environment per stage in your CI system.

In the catladder Config, you declare `Component`s within `components`, where the key is the component name and the value the `ComponentConfig`.

### ComponentConfig

each `ComponentConfig` has this structure:

```ts title="catladder.ts#config.components['componentName']" showLineNumbers
{
  // the working directory within your repo of that component
  dir: "my-dir",
  // environment variables and secrets (see following chapter)
  vars: {},
  // the configuration how the app is built
  build: {},
  // configures how the app will be deployed
  deploy: {},
  // customize each environment, e.g. configure different variables and deployment for production
  env: {},
}
```

### Environments

Every component is deployed into a set of environments, each driven by a
different pipeline trigger:

| Environment | Trigger                      | Purpose                                             |
| ----------- | ---------------------------- | --------------------------------------------------- |
| `local`     | direnv / `catenv`            | your machine — `.env` files, no deployment          |
| `review`    | merge request / pull request | one throwaway app per MR/PR, stopped when it closes |
| `dev`       | push to the main branch      | the always-current development deployment           |
| `stage`     | tagged release `vX.Y.Z`      | pre-production                                      |
| `prod`      | tagged release `vX.Y.Z`      | production, deployed manually by default            |

Disable the ones a component does not need (`env: { stage: false }`) or
override config per environment — see the following chapters.

[direnv]: https://direnv.net/ "unclutter your .profile"
[direnv-install]: https://direnv.net/docs/installation.html "direnv installation instructions"
