---
sidebar_position: 3
---

# Build

Builds define how components are tested and built for deployment.
If the deployement demands a container, the build will also create a docker image.

there are two modes of building: workspaces builds and standalone builds.

standalone builds run for each components, whereas workspace builds can be used by multiple components.

## Standalone Builds

There are currently those standalone build-types:

- [node](#node)
- [node-static](#node-static)
- [rails](#rails)
- [meteor](#meteor)
- [Custom (experimental)](#custom-experimental)

### node

The node build type is meant for node apps that manage dependencies and scripts with `yarn` (yarn berry is supported too).

It supports any node-version by checking for a `.nvmrc` file in the root of the repository or in the component directory.

It will create a docker-image (if the deployment requires a container) based on the alpine version of that node-version.

#### predefined jobs

- lint: will run `yarn lint` in your component
- audit: will run `yarn audit`
- test: will run `yarn test`

### node-static

The `node-static` type is the same as node, but will create a static Nginx Docker image without any node runtime.
This is useful to host static apps (Angular, React, Next.js static exports) on a container hosting.

### rails

The `rails` build type is for Ruby on Rails apps. See the example in `packages/pipeline/examples/rails-k8s-with-worker.ts`.

It creates some very basic test, lint, and audit jobs that most likely need to be customized.

If no `Dockerfile` is present it will build a container with the [Heroku Cloud Native Buildpack Builder](https://github.com/heroku/cnb-builder-images). This has the following implications:

- No variables are available during build unless explicitly provided with `build.cnbBuilder.buildVars`.
- The [buildpacks application contract](https://github.com/heroku/buildpacks-ruby#application-contract) specifies by which rules the container is built
- By default it creates the default launch process `bin/rails server` according to the above application contract. This can be costumized by providing a Heroku-Style `Procfile` in the component directory.
- All commands have to be prefixed with `launcher` to run with the correct environment, e.g. `launcher bin/rails console`.

### meteor

For (legacy) meteor apps.

### Custom (experimental)

Use the custom build type for anything that is not yet built-in to catladder.

```

```

## Workspace Builds

Workspace builds are shared builds that are used by multiple components. There will be only one build job for all components that use the workspace build, but each component still will have its own docker build job.

This may speed up the build process if multiple components share the same build artifacts and greatly reduces the amount of build jobs in the pipeline (which can save money on CI/CD costs).

### Preconditions

- there should be a command in the root package.json that builds all artifacts for all components. This is usually a `yarn build` command.
- similarly there should be a `yarn test` and `yarn lint` command in the root package.json.
- the build command should create the artifacts in a `dist` directory in each component's directory (identical to standalone builds)
- if a component requires env vars during build, you have to set `dotEnv: true` (not `local`!) on that component

### Configuration

To configure a workspace build, you need to define a build in the `builds` section of the config:

```ts title="catladder.ts"
const config = {

  builds: {
    myWorkspace: {
      type: "node", // currently only node is supported
      // those are some default properties:
      dir: "."
      buildCommand: "yarn build"
      test: {
        command: "yarn test"
      },
      lint: {
        command: "yarn lint"
      },
      audit: {
        command: "yarn audit"
      },
    }
  },
  components: {
    api: {
       build: {
          from: "myWorkspace",
          // you can customize the docker config here;
          docker: {
            // ...
          }
       }

    }
  }
} satisfies Config;
```

Components that use those shared builds set the build property to ` from: "<workspace-name>"` like in the example above.

### Remarks

- you can still have components with standalone builds in the same project
- you can have multiple workspace builds in the same pipeline (if you really want...)
- if a component requires env var during build, you have to use `dotEnv: true` as mentioned above. The workspace build job will create a .env in each component that has `dotEnv: true` set before running the build command.

### Turbo Repo

You can use Turbo repo in workspace builds. You can install and configure it as usual.

for caching you can either:

- use remote cache (recommended)
- use gitlab cache:

```ts title="catladder.ts"
const config = {
  builds: {
    myWorkspace: {
      type: "node",
      cache: {
        paths: [".turbo"],
      },
    },
  },
  //...
} satisfies Config;
```

If your build relies on **.env** make sure to include .env in the cache settings:

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "dev": {
      "cache": false,
      "persistent": true
    },

    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**"],
      "inputs": ["$TURBO_DEFAULT$", ".env"]
    },
    "lint": {},
    "test": {}
  }
}
```

See also: [Turbo docs on Handling .env files](https://turbo.build/repo/docs/crafting-your-repository/using-environment-variables#handling-env-files)

### Forcing a turbo build and bypassing the cache

If you want to force a turbo build and bypass the cache on gitlab CI, you can do so by running a pipeline manually in gitlab and setting the `TURBO_FORCE` environment variable to `true`.
