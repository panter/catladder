---
"catladder": minor
---

GitHub Actions: the per-image "ensure image" jobs are replaced by a single `catladder-images` job per workflow, built only from the images that workflow's jobs actually use (plus the release image on main when the release runs later). Workflows without custom-image consumers, such as the review stop workflow, no longer get an image job. This cuts billed minutes, since GitHub rounds every job up to a full minute. A failing image build still blocks dependent jobs and fails the `catladder ✅` gate. GitLab output is unchanged.
