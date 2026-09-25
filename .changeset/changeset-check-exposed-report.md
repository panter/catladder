---
"catladder": patch
---

GitLab: the changeset check job stays green when a merge request adds no changeset — the warning is carried by the report, the job log and the sticky MR comment. A failed (`allow_failure`) job left the MR widget's exposed "changeset report" spinning on "Loading artifacts" forever, because GitLab only resolves exposed artifacts of successful jobs.
