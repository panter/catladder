---
"catladder": patch
---

`allowFailure` now works on the github backend. The flag was lowered for gitlab only and silently dropped for github, so a job marked as non-blocking failed the whole workflow — and with it every job depending on it. The `pages` deploy type is the worst case: it is `allowFailure` by default precisely so a broken site publish cannot block the pipeline, but on github a failed publish also skipped the release job. It now lowers to `continue-on-error`.
