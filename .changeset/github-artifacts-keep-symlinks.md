---
"catladder": patch
---

GitHub Actions: build artifacts are now passed between jobs as a tar archive, so symlinks, file modes and repo-relative paths survive, as they do on GitLab. Plain `upload-artifact` turned symlinks into copies, which broke Next.js/Turbopack apps in pnpm workspaces (`.next/node_modules/<pkg>-<hash>` symlinks into the pnpm store) with `ERR_MODULE_NOT_FOUND` at runtime. Regenerate the workflows with `catenv` to pick up the fix.
