# Build

There are currently those build-types:

- [node](#node)
- [node-static](#node-static)
- [rails](#rails)
- [meteor](#meteor)
- [Custom (experimental)](#custom-experimental)

## node

The node build type is meant for node apps that manage dependencies and scripts with `yarn` (yarn berry is supported too).

It supports any node-version by checking for a `.nvmrc` file in the root of the repository or in the component directory.

It will create a docker-image (if the deployment requires a container) based on the alpine version of that node-version.

### predefined jobs

- lint: will run `yarn lint` in your component
- audit: will run `yarn audit`
- test: will run `yarn test`

## node-static

The `node-static` type is the same as node, but will create a static Nginx Docker image without any node runtime.  
This is useful to host static apps (Angular, React, Next.js static exports) on a container hosting.

## rails

The `rails` build type is for Ruby on Rails apps. See the example in `pipeline/examples/rails-k8s-with-worker.ts`.

It creates some very basic test, lint, and audit jobs that most likely need to be customized.

If no `Dockerfile` is present it will build a container with the [Heroku Cloud Native Buildpack Builder](https://github.com/heroku/cnb-builder-images). This has the following implications:
- No variables are available during build unless explicitly provided with `build.cnbBuilder.buildVars`.
- The [buildpacks application contract](https://github.com/heroku/buildpacks-ruby#application-contract) specifies by which rules the container is built
- By default it creates the default launch process `bin/rails server` according to the above application contract. This can be costumized by providing a Heroku-Style `Procfile` in the component directory.
- All commands have to be prefixed with `launcher` to run with the correct environment, e.g. `launcher bin/rails console`.


## meteor

For (legacy) meteor apps.

## Custom (experimental)

Use the custom build type for anything that is not yet built-in to catladder.
