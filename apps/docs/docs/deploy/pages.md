---
sidebar_position: 4
---

# Pages

`type: "pages"` publishes a static site — docs, a storybook, a coverage
report — on GitLab pages or GitHub pages. The deploy job runs your build
`script` and publishes the output directory (`publishDir`, default
`public`).

```ts title="catladder.ts"
components: {
  docs: {
    dir: "docs",
    // pages only exist on the main branch (+ MR previews)
    env: { stage: false, prod: false },
    build: false,
    deploy: {
      type: "pages",
      requiresInstall: true,
      script: ["yarn workspace docs build"],
      // publishDir: "public",  // default
    },
  },
},
```

Pages deploys default to `allowFailure: true` — a broken site publish
should not block the rest of the pipeline. Override with
`allowFailure: false`.

## GitLab: a site preview per merge request

On GitLab, **every merge request gets its own site preview**: review
environments publish under an `mr-<iid>` path prefix (GitLab parallel
deployments). The prefix is exposed to your build as `$PAGES_PREFIX` in
case the site needs to adjust its base url. The GitLab environment url
points at the published site.

## GitHub: one site per repository

On GitHub the site is published with `actions/deploy-pages`. Two
consequences:

- **Set the repository's Pages source to "GitHub Actions" once**
  (Settings → Pages → Build and deployment → Source). Catladder cannot
  do this for you, and the deploy job fails until it is set.
- **No per-pull-request previews** — GitHub serves a single site per
  repository, so there is no equivalent of GitLab's parallel
  deployments. Disable the review environment for the component
  (`env: { review: false }`) if you were relying on previews.
