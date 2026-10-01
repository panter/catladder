---
"catladder": patch
---

Cloud Run: on review environments `CLOUD_RUN_JOB_TRIGGER_URL_<job>` no longer expands with literal quotes around the job name (`…/jobs/"pan-app-review-"mr123"-api"-myjob:run`). The url is now kept as a bash expression, so the review slug is evaluated like everywhere else.
