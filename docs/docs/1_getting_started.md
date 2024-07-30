---
sidebar_position: 1
---

# Getting started

:::note

Currently, only GitLab is supported.

:::

## Install

### Local mode

1. Install catladder CLI: `yarn add -D @catladder/cli`
1. Create the file `catladder.ts` in your repositories root.
1. set `pipelineType: "gitlab",` in your `catladder.ts`

```ts title="catladder.ts"
import type { Config } from "@catladder/cli";
const config: Config = {
  appName: "example-app",
  customerName: "pan",
  pipelineType: "gitlab",
  components: {},
};
export default config;
```

#### Direnv

Setup [direnv][direnv-install].  
Add the following to your `.envrc`:

```sh title=".envrc"
layout node # allows for local installations of catladder-cli

# if catladder is available, invoke catenv
if command -v 'catenv' >/dev/null; then
  watch_file catladder.ts
  echo "using catenv"
  # if you have dotenv enabled
  catenv                # generates .env and .gitlab-ci.yml
  dotenv_if_exists .env # loads .env file if it exists in your shell

  # eval is needed if you rely on exported env vars.
  eval "$(catenv)"
fi
```

[direnv][direnv] requires you to allow its config changes by calling `direnv allow` in the project root.

This will now generate `.gitlab-ci.yml` whenever something in catladder.ts changes, and you enter the project directory with your shell.

#### Finalize setup

Commit that file with git.

1. Install gcloud CLI: https://cloud.google.com/sdk/docs/install-sdk
1. Authenticate gcloud CLI with `gcloud auth login`

### The configuration

`catladder.ts` is the central configuration for your project.  
You can use TypeScript to get full advantage of type checking in this configuration (YAML is also supported, but not recommended).

The configuration's basic structure looks like this:

```ts title="catladder.ts" showLineNumbers
import type { Config } from '@catladder/cli'

const config: Config = {
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
}

export default config
```

### Components

A `Component` is one subapp/service/piece of your application. E.g. in a typical app with frontend and API, both the frontend and the API would be a `Component` in catladder.  
Each `Component` is usually one deployment and one Environment in GitLab.

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

[direnv]: https://direnv.net/ "unclutter your .profile"
[direnv-install]: https://direnv.net/docs/installation.html "direnv installation instructions"
