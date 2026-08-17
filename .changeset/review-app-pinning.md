---
"catladder": minor
---

Review apps of a merge request can now be pinned so they outlive the auto-stop timer (gitlab). Review deploy jobs read their `auto_stop_in` from the pipeline variable `CL_REVIEW_AUTO_STOP`; a workflow rule sets it to `never` while the MR carries the pin label (default `catladder::pin-review`), so the pin lives on the MR and survives redeploys — unlike gitlab's per-environment pin button, which the next deploy resets. Merging or closing the MR still stops the apps. `catladder mr pin` / `mr unpin` manage the label (creating it in the project when missing) and `pin` triggers a pipeline so the pin takes effect immediately. The previously hardcoded lifetimes are now configurable via top-level `autoStop` in catladder.ts (`review` default "1 week", `dev` default "4 weeks", `pinLabel` — `false` disables the mechanism). GitHub is unaffected: it has no auto-stop, review apps live until the pull request closes.
