---
sidebar_position: 3
---

# npm package

`type: "npmPackage"` publishes the component to an npm registry instead
of deploying a service — "deploying" means `npm publish`. Every pipeline
trigger publishes a matching flavor of the package:

| Trigger                 | Environment | Version                     | dist-tag                                              |
| ----------------------- | ----------- | --------------------------- | ----------------------------------------------------- |
| tagged release `vX.Y.Z` | `prod`      | `X.Y.Z`                     | `latest`                                              |
| push to main branch     | `dev`       | `0.0.0-<branch-slug>-<sha>` | branch slug for `next`/`beta` branches, else `canary` |
| merge request           | `review`    | `0.0.0-<branch-slug>-<sha>` | `canary`                                              |

MR canaries are real, installable versions — reviewers can
`yarn add your-package@0.0.0-feat-x-abc123` to try a change before it
merges.

```ts title="catladder.ts"
components: {
  lib: {
    dir: "lib",
    // npm has no staging: disable it so tagged releases publish
    // latest directly (prod auto-deploys when stage is disabled)
    env: { stage: false },
    build: { type: "node" },
    deploy: {
      type: "npmPackage",
      // access: "public",                       // default
      // registry: "https://registry.npmjs.org/", // default
      // distTag: "nightly",                     // override the derivation
    },
  },
},
```

## Authentication

### A token (both backends)

The publish authenticates with the `NPM_TOKEN` secret, managed like any
other catladder secret:

```bash
echo -n "npm_xxx" | yarn catladder project secrets-set dev:lib NPM_TOKEN
```

Use an automation token so publishing works without OTP.

### Trusted publishing / OIDC (GitHub only)

On GitHub you can publish **without storing a token at all**: npm
[trusted publishing](https://docs.npmjs.com/trusted-publishers) lets the
workflow exchange a short-lived GitHub OIDC token for publish rights.
Catladder declares the required `permissions: id-token: write` on the
deploy job; the rest is one-time setup on npmjs.com:

1. Open the package's _Settings → Trusted publisher_ on npmjs.com
2. Select GitHub Actions, enter the repository, and the **workflow
   filename** that publishes it — `catladder-release.yml` for tagged
   releases

npm allows exactly **one** trusted publisher per package, so canary
publishes coming from the main-branch and review workflows
(`catladder-main.yml` / `catladder-review.yml`) still need `NPM_TOKEN`.

If `NPM_TOKEN` is set it always wins over OIDC — unset it once trusted
publishing works, otherwise the token silently stays in charge. When
neither is available the job fails with an explicit error rather than
publishing anonymously.

## How it works

The deploy job runs `catci publish npm` (catladder's CI companion,
materialized into `.catladder-generated/catci/`): it derives version and
dist-tag from the pipeline trigger, stamps the version into the
package's `package.json` and runs `npm publish`. It works on both the
GitLab and GitHub backends.

Combine it with [releases](../7_releases.md) to get the full flow:
the release job tags `vX.Y.Z`, the tag triggers the release pipeline,
and the prod deploy publishes that version as `latest`.
