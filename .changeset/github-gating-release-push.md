---
"catladder": patch
---

GitHub: merge gating no longer blocks the release job's push.

`project setup` used to require the `catladder ✅` aggregate check via
classic branch protection. The release job pushes the release commit and
tag straight to the default branch with the workflow token — and that
fresh commit can never have a passing check yet, so catladder's own
gating rejected its own release (`GH006: Protected branch update
failed`).

Setup now configures the gating as a repository ruleset
(`catladder merge gating`) instead: same required check for PRs and
humans, plus a bypass for the GitHub Actions app so the release job can
push. Classic-protection gating from earlier versions is migrated away
automatically (only the aggregate check is touched; other protection
settings are preserved). `project doctor` verifies the ruleset and flags
the legacy setup, and the release job now explains the fix when its push
is rejected by branch protection.
