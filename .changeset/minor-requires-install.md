---
"catladder": minor
---

`requiresInstall` replaces `requiresYarnInstall` on the `custom` and `pages` deploy configs, since the install now runs with whichever package manager the project uses. `requiresYarnInstall` keeps working as a deprecated alias with identical behavior.
