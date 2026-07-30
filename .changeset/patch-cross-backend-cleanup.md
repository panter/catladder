---
"catladder": patch
---

Disabling a pipeline backend now cleans up after itself. `catenv` only ever removed the files of the backends that were still enabled, so switching `pipelines` from gitlab to github left `.gitlab-ci.yml` and `.catladder-generated/gitlab/` behind — and a stale `.gitlab-ci.yml` keeps running a stale pipeline. A full generation now also runs the cleanup of every backend that is *not* enabled. A `.gitlab-ci.yml` is only deleted when it carries catladder's generated-file marker, so a hand-maintained one is left untouched.
