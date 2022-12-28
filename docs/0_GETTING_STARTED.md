## Getting started

### Gitlab

currently only gitlab is supported.

1. create a .gitlab-ci.yml file with this content: include: https://git.panter.ch/api/v4/projects/catladder%2Fcatladder/packages/generic/ci-includes/v1/gitlab-ci.yml
2. its recommended to add a local version of @catladder/cli and @catladder/pipeline as dev dependencies to your project
3. create a file `catladder.ts` in the root of your repository

## The Config

`catladder.ts` is the central configuration for your project. You can use typescript to get full advantage of type checking in this configuration (yaml is also supported, but not recommended). It has this structure:

```typescript

import type { Config } from '@catladder/pipeline`


const config: Config = {

   appName: "my-first-app",
   customerName: "pan",
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

a `Component` is one subapp/service/piece of your application. E.g. in a typical app with frontend and api, both the frontend and the api would be a `Component` in catladder. Each `Component` usually is one deployment and one Environment in gitlab.

in the catladder Config, you declare `Component`s within `components`, where the key is the component name and the value the `ComponentConfig`.

### ComponentConfig

each `ComponentConfig` has this structure:

```typescript
{
  dir: "my-dir", // the working directory within your repo of that component
  vars: {}, // environment variables and secrets (see following chapter)
  build: {}, // the configuration how the app is built
  deploy: {}, // configures how the app will be deployed
  envs: {}, // customize each environment, e.g. configure different variables and deployment for production
}
```

# VARS

see [VARS](1_VARS.md)

# BUILD

see [BUILD](2_BUILD.md)

# DEPLOY

see [DEPLOY](3_DEPLOY.md)
