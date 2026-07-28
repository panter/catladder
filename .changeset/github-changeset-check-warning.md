---
"catladder": patch
---

The changeset check no longer marks its GitHub job as failed when a pull request adds no changeset. GitHub has no yellow "allow_failure" state like GitLab, so the non-blocking nudge showed up as a red ❌ with "Process completed with exit code 1", which reads like something broke. On GitHub the job now stays green and reports a warning annotation plus the report in the run summary (the sticky PR comment is unchanged); on GitLab the job still turns yellow.
