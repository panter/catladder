---
"catladder": patch
---

Fix corrupted kubernetes deploys ("error unpacking mailhog-5.0.1.tgz in the-panter-chart: gzip: invalid header"): the shipped job image definitions were materialized into `.catladder-generated/images/` as utf-8 text, which mangled binary files such as the packaged helm chart dependencies of the kubernetes image. Binary files are now written byte for byte, and the shipped image tags change once, so repositories rebuild the images that were built from the corrupted files.
