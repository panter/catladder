---
"catladder": minor
---

Project-declared job images: declare Docker images under `images` in catladder.ts (`{ dir, buildArgs?, hashExtraPaths? }`) and reference them in any `jobImage` field via `{ image: "<name>" }` — build, test, custom/pages deploy, and verify jobs alike. Catladder generates a `🐳 image <name>` job that builds the image content-hashed into the project registry under `job-images/` and skips when the tag already exists, on both the GitLab and GitHub backends. The image dir is used in place — nothing is copied into `.catladder-generated`. Catladder's own built-in image build jobs are renamed from `🐳 job image <name>` to `🐳 catladder image <name>` to tell the two apart.
