---
"catladder": minor
---

pnpm projects now run CI without any dependency cache, and the pnpm
store no longer travels into docker images.

Measured on a 3800-package monorepo, with every configuration run as
jobs in the same pipeline so they shared fleet conditions:

- **node_modules cache**: restoring it (1.29 GB, 348k files) cost ~125s
  to save 6s of install; writing it cost ~190s more.
- **store cache**: on gitlab a job with the store took 74s against 35s
  with no cache at all — the restore alone (53s) exceeded a full
  from-registry install (30-42s), because the runner zips the store file
  by file. On github (single zstd stream) it was a wash: ~60s vs ~64s.
- **store in the docker image**: the worst of the three. The store is
  copied into a layer *below* node_modules, so pnpm cannot hardlink
  across the overlay boundary and copies every package instead. The
  in-image install was *slower* that way (28.4s vs 9.6s from the
  registry), while adding 3 GB to the build context and to the shipped
  image: build 339s → 27s, image 3.35 GB → 0.73 GB.

So pnpm builds now: install with no cache, use pnpm's own store location
instead of a project-local `.pnpm-store` (nothing to cache, nothing to
leak into a build context), and let the docker `--prod` install download
from the registry — into scratch space that is dropped in the same layer,
so packages ship once.

Generated pipelines lose all pnpm `cache:` blocks and the
`COPY .pnpm-store` line. Yarn caching is unchanged.
