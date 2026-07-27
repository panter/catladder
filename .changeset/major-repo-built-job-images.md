---
"catladder": major
---

Job images are now always built from your repository (`jobImages: "repo"` behavior); the central image registry mode has been removed. Image definitions are materialized into `.catladder-generated/images/`, tagged by content hash and built by the pipeline only when missing. Projects still configured with the central mode must drop that setting and commit the materialized image definitions on the next regeneration.
