---
sidebar_position: 3
---

# Build

Builds define how components are tested and built for deployment.
If the deployment demands a container, the build will also create a docker image.

There are two modes of building: workspace builds and standalone builds.

Standalone builds run for each component, whereas workspace builds can be shared by multiple components.

## Standalone Builds

There are currently those standalone build-types:

- [node](#node)
- [node-static](#node-static)
- [rails](#rails)
- [meteor](#meteor)
- [Custom (experimental)](#custom-experimental)

### node

The node build type is meant for node apps that manage dependencies and scripts with `yarn` (classic and berry) or `pnpm`.

The package manager is autodetected: the `packageManager` field in package.json wins, then the lockfile present (`pnpm-lock.yaml` → pnpm, `yarn.lock` → yarn). You can override the detection with `packageManager: "pnpm" | "yarn"` at the top level of `catladder.ts`. All generated install commands, caches and default commands follow the detected package manager (the examples below use `yarn`; in a pnpm project they become `pnpm ...`).

It supports any node-version by checking for a `.nvmrc` file in the root of the repository or in the component directory.

It will create a docker-image (if the deployment requires a container) based on the alpine version of that node-version.

#### predefined jobs

- lint: will run `<package manager> lint` in your component
- audit: audits the production dependencies of every workspace and fails on
  critical advisories. Lower the threshold with `audit: { level: "high" }`
  (`info` | `low` | `moderate` | `high` | `critical`)
- test: will run `<package manager> test`

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

For (legacy) meteor apps. Yarn-only — a pnpm project cannot use this build type.

### Custom (experimental)

Use the custom build type for anything that is not yet built-in to catladder:
you provide the Dockerfile and the commands, catladder wires up the jobs,
caching and variables around them.

See the [build reference](./4_agents/skills/catladder-builds/references/build-types.md)
for the full set of options.

## Project Images

When your build or test jobs need a specific Docker image (e.g. Java + Maven, Playwright, a custom toolchain), you can declare it under `images` and catladder builds it automatically in your pipeline — on GitLab and GitHub alike.

### How it works

1. You provide a `Dockerfile` — either a directory in your repo (e.g. `docker/java-build/Dockerfile`) or written inline in the config
2. You declare it in your catladder config under `images`
3. You reference it in any `jobImage` field using `{ image: "<name>" }`

Catladder will:

- **Hash** all files in the image directory (plus `hashExtraPaths` and `buildArgs`) at generation time and use the hash as the image tag
- **Generate a build job** (`🐳 image <name>`) in the `setup` stage. On GitLab it only runs when the image inputs change (via `rules:changes`); on GitHub it always runs, but a registry existence check skips the build when the tag already exists
- **Set `needs: optional: true`** on consumer jobs so they don't wait for the build job when it doesn't run

This means: **zero pipeline overhead** when the image hasn't changed, and automatic rebuilds when it does.

### Configuration

An image is declared either with a **directory** or with an **inline Dockerfile**:

```ts title="catladder.ts"
const config = {
  images: {
    // (a) a directory in the repository
    "java-build": {
      // directory containing a Dockerfile (also the default build context)
      dir: "docker/java-build",
      // optional: Docker build arguments (part of the content hash)
      buildArgs: { MAVEN_VERSION: "3.9.9" },
      // optional: extra files to include in hash + change detection
      hashExtraPaths: ["shared/settings.xml"],
    },
    // (b) an inline Dockerfile — as lines or as one string
    "db-tools": {
      dockerfile: [
        "FROM alpine:3.21",
        "RUN apk add --no-cache postgresql17-client",
      ],
    },
  },
  components: {
    api: {
      dir: "api",
      build: {
        type: "custom",
        jobImage: { image: "java-build" },
        docker: { type: "custom" },
      },
      deploy: {
        /* ... */
      },
    },
  },
} satisfies Config;
```

With `dir`, the directory must contain a `Dockerfile`. All files in it are part of the content hash and watched for changes — nothing is copied into `.catladder-generated`, the directory is used in place.

With `dockerfile`, the content is written to `.catladder-generated/images/project/<name>/Dockerfile` (generated, never edit it) so the pipeline builds from a committed, reviewable file. Use it for small images that only need `FROM` + a few `RUN`s.

### Build context

`context` sets the docker build context, relative to the repository root:

| declaration  | default context           |
| ------------ | ------------------------- |
| `dir`        | the `dir` itself          |
| `dockerfile` | the repository root (`.`) |

Set it explicitly when the image needs to `COPY` files from elsewhere, e.g. `{ dir: "docker/java-build", context: "." }` to build a Dockerfile that copies from the repository root.

:::warning
The build context is **not** part of the content hash — it can be the whole repository. Only the Dockerfile (or `dir`), `buildArgs` and `hashExtraPaths` are hashed. If your image `COPY`s a file and changing that file should rebuild the image, list it in `hashExtraPaths`.
:::

`{ image: "<name>" }` works in every `jobImage` field: build jobs, test jobs (`build.test.jobImage`), custom and pages deploys, and post-deploy verify jobs:

```ts title="catladder.ts"
build: {
  type: "node",
  test: {
    jobImage: { image: "playwright" },
  },
},
```

### How images are stored

Images are pushed to your project's own container registry:

- GitLab: `$CI_REGISTRY_IMAGE/job-images/<name>:<content-hash>`
- GitHub: `ghcr.io/<owner>/<repo>/job-images/<name>:<content-hash>`

The `job-images/` prefix keeps them apart from your deployable component images and build caches. Catladder's own built-in job images live under `catladder/` in the same registry. Old images remain in the registry and can be cleaned up via registry retention policies.

### Errors at generation time

`yarn catenv` fails fast (no pipeline files are written) when:

- a `jobImage` references a name that isn't declared in `images` — the error lists the declared names
- the declared `dir` doesn't exist
- the declared `dir` has no `Dockerfile`

(`dir` and `dockerfile` are mutually exclusive — declaring both is a type error.)

### Edge cases

- **First pipeline run**: the image doesn't exist yet, the build job runs and builds it, consumer jobs wait
- **Image deleted from registry**: consumer jobs will fail (the image can't be pulled). Re-run the pipeline after touching the Dockerfile to trigger a rebuild.
- **Config-only changes**: `buildArgs` / `hashExtraPaths` changes alter the image tag without touching the image directory — the build job also watches `catladder.ts`, so it still runs
- **Tagged releases**: GitLab's `rules:changes` may always evaluate to true for tags. The build job handles this gracefully by checking the registry first and skipping the build if the image already exists.

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
        // the default command audits production dependencies and fails on
        // critical advisories; `level` moves that threshold
        level: "critical"
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
