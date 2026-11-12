---
"catladder": minor
---

GitHub Actions workflows now run a single `🐳 catladder images` job that checks and builds all job images, and only where an image is actually used; workflows without an image consumer no longer get image jobs. GitLab pipelines are unchanged.
