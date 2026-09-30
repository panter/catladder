---
"catladder": minor
---

New `build.reuseMainBranchImage` option: in tagged-release pipelines the docker job of stage/prod copies the image the main branch already built for the released commit (registry-side, same digest) instead of building it again, and falls back to a regular build when there is none. Meant for images that don't depend on the env, e.g. Rails apps built with Cloud Native Buildpacks.
