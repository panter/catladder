---
"catladder": minor
---

Project-declared job images: declare Docker images under `images` in catladder.ts and reference them in any `jobImage` field via `{ image: "<name>" }` — build, test, custom/pages deploy, and verify jobs alike. An image is declared either with a directory (`{ dir }`, used in place — nothing is copied into `.catladder-generated`) or with an inline Dockerfile (`{ dockerfile: string | string[] }`, materialized into `.catladder-generated/images/project/<name>/Dockerfile`); both support `context`, `buildArgs` and `hashExtraPaths`. Catladder generates a `🐳 image <name>` job that builds the image content-hashed into the project registry under `job-images/` and skips when the tag already exists, on both the GitLab and GitHub backends. Catladder's own built-in image build jobs are renamed from `🐳 job image <name>` to `🐳 catladder image <name>` to tell the two apart.
