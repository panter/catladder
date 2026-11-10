---
"catladder": minor
---

GitHub Actions: closing a pull request that never attempted a review deploy no longer runs the review-stop jobs and the image jobs that only serve them. A guard job in `review-stop.yml` decides from the `catladder:review-deployed` marker label, which the review deploy sets before it creates any resource. It fails open when undeterminable, and pull requests deployed before this change (no marker) are still stopped. Manual `workflow_dispatch` stops are unaffected.
