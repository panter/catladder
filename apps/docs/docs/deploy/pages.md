---
sidebar_position: 4
---

# GitLab pages

`type: "pages"` publishes a static site — docs, a storybook, a coverage
report — on GitLab pages. The deploy job runs your build `script` and
publishes the output directory (`publishDir`, default `public`) as the
pages artifact.

**Every merge request gets its own site preview**: review environments
publish under an `mr-<iid>` path prefix (GitLab parallel deployments).
The prefix is exposed to your build as `$PAGES_PREFIX` in case the site
needs to adjust its base url. The GitLab environment url points at the
published site.

```ts title="catladder.ts"
components: {
  docs: {
    dir: "docs",
    // pages only exist on the main branch (+ MR previews)
    env: { stage: false, prod: false },
    build: false,
    deploy: {
      type: "pages",
      requiresYarnInstall: true,
      script: ["yarn workspace docs build"],
      // publishDir: "public",  // default
    },
  },
},
```

Pages deploys default to `allowFailure: true` — a broken site publish
should not block the rest of the pipeline. Override with
`allowFailure: false`.

:::note
Not yet supported on the GitHub backend: GitHub pages has no
parallel-deployment equivalent for MR previews. A deploy via
`actions/deploy-pages` (without previews) may come later.
:::
