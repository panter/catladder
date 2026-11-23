---
"@catladder/cli": minor
---

GitHub: `releases.requireStatus: { context, workflow }` gates manual releases on an external result for exactly the released commit — e.g. an e2e suite that runs in its own workflow after the dev deploy and reports the commit status `e2e-main`. `create release` releases when the result is green, queues while it is pending and fails when it is red or missing; `release on green` also runs when the gate workflow completes, and the release job refuses to release when main moved on from the gated commit.
