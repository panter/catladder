---
"catladder": patch
---

Changesets releases now create the release entry on the git host (gitlab `/-/releases`, github `/releases`) with the changelog as its description — previously only the tag was pushed, so the releases page stayed empty (on the semantic-release path `@semantic-release/gitlab` did this). The api call never fails the job: the commit and tag are already pushed when it runs, so a missing token only warns.
