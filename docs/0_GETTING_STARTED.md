## Getting started

**Note**: _Currently, only GitLab is supported._

### Install for a GitLab project

1. Create a `.gitlab-ci.yml` file with this content:

```yaml
include: https://git.panter.ch/api/v4/projects/catladder%2Fcatladder/packages/generic/ci-includes/v1/gitlab-ci.yml
```

2. It's recommended to add a local version of `@catladder/cli` and `@catladder/pipeline` as dev dependencies to your project.
3. Create the file `catladder.ts` in your repositories root.
4. Install gcloud CLI: https://cloud.google.com/sdk/docs/install-sdk
5. Authenticate gcloud CLI with `gcloud auth login`

## The configuration

`catladder.ts` is the central configuration for your project.  
You can use TypeScript to get full advantage of type checking in this configuration (YAML is also supported, but not recommended).

The configuration's basic structure looks like this:

```typescript

import type { Config } from '@catladder/pipeline'


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

```typescript
{
  dir: "my-dir", // the working directory within your repo of that component
  vars: {}, // environment variables and secrets (see following chapter)
  build: {}, // the configuration how the app is built
  deploy: {}, // configures how the app will be deployed
  env: {}, // customize each environment, e.g. configure different variables and deployment for production
}
```

# Environment variables

See [VARS](1_VARS.md)

# BUILD

See [BUILD](2_BUILD.md)

# DEPLOY

See [DEPLOY](3_DEPLOY.md)

# TROUBLESHOOT

See [TROUBLESHOOT](4_TROUBLESHOOT.md)

# RECIPES

See [RECIPES](5_RECIPIES.md)

# SECURITY AUDIT

See [SECURITY AUDIT](6_SECURITY_AUDIT.md)

