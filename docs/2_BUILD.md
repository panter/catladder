# Build

there are currently those build-types:

## node

the node build type is meant for node apps that manage dependencies and scripts with `yarn` (yarn berry is supported too).

It supports any node-version by checking for a `nvmrc` file in the root of the repository or in the component directory.

It will create a docker-image (if the deployment requires a container) based on the alpine version of that node-version.

### predefined jobs

- lint: will run `yarn lint` in your component
- audit: will run `yarn audit`
- test: will run `yarn test`

## node-static

The node-static type is the same as node, but will create a static nginx docker image without any node runtime. This is useful to host static apps (angular, react, nextjs static exports) on a container hosting

## meteor

For (legacy) meteor apps.

## Custom (experimental)

Use the custom build type for anything that is not yet built-in in catladder
