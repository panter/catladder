---
sidebar_position: 2
---

# Custom

Use `type: "custom"` when none of the built-in deploy types fits: the
deploy job runs your own script, with all of the component's environment
variables and secrets available.

```ts title="catladder.ts"
components: {
  app: {
    dir: "app",
    build: { type: "node" },
    deploy: {
      type: "custom",
      // whether the deploy needs the built docker image (adds the
      // docker build job and logs the runner into the registry)
      requiresDocker: true,
      // run the package manager install before the script
      requiresInstall: false,
      script: ["./scripts/deploy.sh"],
      // used to tear the environment down again — review apps call this
      // when their merge request closes
      stopScript: ["./scripts/undeploy.sh"],
      // run the script in a specific image (see "Project Images")
      // jobImage: { image: "deploy-tools" },
    },
  },
},
```

| Option            | Type         | Purpose                                                      |
| ----------------- | ------------ | ------------------------------------------------------------ |
| `requiresDocker`  | `boolean`    | **required** — whether the deploy needs a built docker image |
| `script`          | `string[]`   | **required** — the deploy script                             |
| `requiresInstall` | `boolean`    | run the package-manager install (yarn/pnpm) first            |
| `stopScript`      | `string[]`   | script that stops/tears down the environment                 |
| `jobImage`        | image ref    | image the job runs in                                        |
| `artifactsPaths`  | `string[]`   | job artifacts the deploy produces, relative to the repo root |
| `cache`           | cache config | additional cache paths for the job                           |

Everything a built-in deploy type would inject is available to the
script: `ROOT_URL`, `HOSTNAME`, `PORT`, the component's `vars.public`
and secrets, plus the docker image reference when `requiresDocker` is
set.

## `dockerTag`

`type: "dockerTag"` does not deploy anything itself — it adds a custom
tag to the built image in the registry, so an external system can deploy
that tag:

```ts title="catladder.ts"
deploy: {
  type: "dockerTag",
  tag: "production",
},
```

:::warning

This is a legacy deploy type, used historically by a single project.
Runtime environment variables have to be coordinated manually with
whatever consumes the tag, so prefer `custom` for new projects.

:::
