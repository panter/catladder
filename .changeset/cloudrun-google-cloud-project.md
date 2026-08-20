---
"catladder": minor
---

`google-cloudrun` deploys now inject `GOOGLE_CLOUD_PROJECT` (set to the deploy's `projectId`) into every environment's env vars — deployed envs and the `local` env alike. google client libraries and hand-rolled code resolve the GCP project id from the environment without a metadata-server round trip, and projects no longer need their own helper to inject it into local envs. An explicit `vars.public.GOOGLE_CLOUD_PROJECT` still wins.
