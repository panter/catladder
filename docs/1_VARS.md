# Environment variables

Environment variables can be declared on a component like this:

```typescript
vars: {
  public: {
    MY_ENV_VAR: "my variable",
    MY_OTHER_VAR: "some value",
    // you can also reference other variables
    SOME_VAR: "hello from $MY_OTHER_VAR",
    // you can reference variables (public and secret) from othr components too!
    GRAPHQL_ENDPOINT: "${api:ROOT_URL}/graphql`
  },
  secret: ["API_KEY", "GOOGLE_TAG_MANAGER_ID"] // declare secrets as an array of strings. see following chapter
}

```

## Where to use env-vars

All vars (including secrets) are currently available both on build-time (in the pipeline) and on run-time (unless it's a static deployment).

Locally, you can use `catenv` to get the env-vars in your local environment. See section "Env vars in local development" below.

It is also possible to generate .env files automatically on local development and during build. See section ".env files" below.

## predefined variables

- `ROOT_URL`: this is the public URL of a component. In review and dev environment, this is normally auto-generated depending on the deployment type
- `PORT`: the port the app should listen to.

Depending on the deploy type, more variables are available.

## managing secrets

Secrets are env-vars that should not be checked into the source code.

_⚠️ secrets are currently stored in GitLab. It may not be suitable for super-high-security cases._

If you added a new key to `secrets` or want to change secrets, open a terminal and invoke `yarn catladder` (or just `catladder` if installed globally) and then

`project-config-secrets` (you can autocomplete in the catladder cli)

This will open up your editor with all env vars in the YAML-format.  
Save this file close it and catladder will update the secrets.

Editor is selected from your shell's environment variables `$VISUAL`, `$EDITOR` or fallbacks to `code` or `vim`. Careful with `EDITOR=code` - this will not work correctly. The correct way is `EDITOR="code --wait"`.

_catladder makes a copy of old values as backup, you can restore those manually in GitLab if needed_

## Env vars in local development

Locally you can inject the env-vars into your local environment by using `catenv`.

### Setup

- It its recommended to invoke catenv using [direnv](https://direnv.net/), so install that first.
- `yarn add -D @catladder/cli` in the root of your project
- next create a `.envrc` file in your project root with the following content:

```sh

layout node # allows for local installations of catladder-cli

# if catladder is available, invoke that
if hash catenv 2>/dev/null; then
  echo "using catenv"
  watch_file catladder*
  eval "$(catenv)" # this will also interpret the output of catenv, which is used to inject envvars in the current shell
fi
```

### Usage

There are two modes that can be configurd per component in `catladder.ts`:

- creating .env files automatically (recommended)
- injecting env-vars in the shell (legacy)

#### .env files

To use `.env` files, set `dotEnv` to `"local"` on the component:

```ts
// ...
  components: {
    api: {
      dotEnv: "local", // <--
      envDTs: true, // not mandatory, but recommended, see below
      dir: "api",
```

If you also need .env files in the build, set `dotEnv` to `true` on the component instead.
This will create .env files both locally and during build. This is typically required for native apps (e.g. react-native).

⚠️ Don't set `dotEnv` to `true` if you only need .env files locally, otherwise it may include secrets in the build artifacts.

##### Using .env files

When `dotEnv` is set to `"local"`, `catenv` will create `.env` files in the component's directory.

- Starting with node 20 .env files can be loaded without third-party tools: `node -env-file=.env my-app.js`
- For earlier node versions or if you need more control, use [dotenvx](https://github.com/dotenvx/dotenvx): `yarn run -T dotenvx run my-app.js` Or in combination with [`tsx`](https://github.com/privatenumber/tsx): `yarn run -T dotenvx run tsx my-app.ts`
- The older [dotenv](https://github.com/motdotla/dotenv) is also a vialable option, but less convenient

#### Injecting env-vars in the shell

By default `catenv` instead writes `EXPORT` statements to the shell. This is the legacy way of injecting env-vars in the shell.

- each env var is exported twice, once with the component name as prefix and once without
- this has the downside that if multiple components declare the same env var, the last one wins and overwrites the previous one
- It is therefore recommended to migrate to .env files

#### Typescript and process.env

To get autocompletion in IDE on `process.env`, set `envDTs` to `true` on component:

```ts
// ...
  components: {
    api: {
      envDTs: true, // <--
      dir: "api",
// ...
```

This will make `catenv` generate `env.d.ts` file with type definitions for `process.env`.
