# VARS

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

all vars (including secrets) are currently available both on build-time (in the pipeline) and on run-time (unless its a static deployment)

## predefined variables

- `ROOT_URL`: this is the public url of a component. In review and dev environment, this is normally auto-generated depending on the deploy type
- `PORT`: the port the app should listen to.

depending on the deploy type, more variables are available

## managing secrets

secrets are env-vars that should not be checked into the source code.

_⚠️ secrets are currently stored in gitlab. It may not be suitable for super-high-security cases._

if you added a new key to `secrets` or want to change secrets, open a terminal and invoke `yarn catladder` (or just `catladder` if installed globally) and then

`project-config-secrets` (you can autocomplete in the catladder cli)

this will open up your editor with all env vars in the YAML-format. Save this fill close it and catladder will update the secrets.

_catladder makes a copy of old values as backup, you can restore those manually in gitlab if needed_
