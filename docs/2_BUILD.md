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

The `rails` build type is for Ruby on Rails apps.

It creates some very basic test, lint, and audit jobs that most likely need to be customized.

It will build a container thanks to Cloud Native Buildpacks, similar to Heroku. This has the following implications:
- A Dockerfile is ignored.
- No variables are available during build unless explicitly provided with `build.cnbBuilder.buildVars`.
- The Cloud Native Buildpack creates these default processes, which are available as `<process-type>` commands inside the container:  
  ```sh
  TYPE          SHELL COMMAND
  web (default) bash  bin/rails server -p ${PORT:-5000} -e $RAILS_ENV
  console       bash  bin/rails console
  rake          bash  bundle exec rake
  worker        bash  bundle exec rake jobs:work
  ```

  Define additional ones in a Procfile like with Heroku.

- All other commands have to be prefixed with `launcher` to run with the correct environment, e.g. `launcher bundle exec rake db:migrate` is the same as using the shorthand `rake db:migrate` defined in the Procfile.


## meteor

For (legacy) meteor apps.

## Custom (experimental)

Use the custom build type for anything that is not yet built-in to catladder.
