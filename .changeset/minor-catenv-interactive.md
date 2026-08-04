---
"catladder": minor
---

catenv is interactive when a human runs it: attached to a terminal it can now run the gitlab token setup and vault unlock prompts, instead of aborting with a `NonInteractiveError` mid-wizard. Under direnv, turbo or CI (stdout not a TTY) it stays non-interactive automatically, and `--non-interactive` forces that on a terminal too. In non-interactive runs a missing gitlab token now fails fast with the remedy ("run `catenv` once in a terminal") rather than starting a prompt it cannot answer, and the bitwarden unlock prompt is suppressed as well.
