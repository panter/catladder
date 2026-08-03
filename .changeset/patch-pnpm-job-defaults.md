---
"catladder": patch
---

Two pnpm detection fixes. Standalone (non-workspace) node components generated `yarn lint` / `yarn test` for their lint and test jobs regardless of the detected package manager — they now follow it, like the build and start commands and like workspace builds already did. And a `packageManager` field written by `corepack use` (`pnpm@11.6.0+sha512.…`) had its integrity suffix carried into `npm install -g pnpm@<version>` in the generated docker build, where it is not a valid npm spec; the suffix is now stripped where the field is parsed.
