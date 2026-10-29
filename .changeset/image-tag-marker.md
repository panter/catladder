---
"catladder": patch
---

Fix GitLab pipelines skipping the `🐳 catladder image <name>` build jobs when an update changes the image tags but leaves the image definitions untouched (e.g. updating from ≤5.3.1, where only the hash salt changed). Every job on the new tag then failed with an image pull error. Each materialized image dir under `.catladder-generated/images/` now carries an `IMAGE_TAG` file with the tag, so every tag change also changes a file the build job watches. Run `catenv` after updating and commit the new files.
