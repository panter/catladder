---
"catladder": minor
---

`npmPackage` components can publish to npm without a stored token, using npm trusted publishing (OIDC). On github the publish job now declares `id-token: write`, and when the workflow can mint an OIDC token catladder skips the `.npmrc` entirely and lets npm exchange the token for short-lived credentials — provenance is attested automatically. `NPM_TOKEN` stays supported and still wins when it is set, so gitlab and untrusted workflows are unaffected.

Publishing moved to its own `npm-publish` job image, because trusted publishing needs npm >= 11.5.1, which the `jobs-default` node does not carry.

To use it, register the package's trusted publisher on npmjs.com with the repository and the **workflow filename** that publishes it (`catladder-release.yml` for tagged releases). npm allows one trusted publisher per package, so canary publishes from the main-branch and review workflows still need `NPM_TOKEN`.
