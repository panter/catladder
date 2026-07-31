---
"catladder": major
---

Job images slim down. The `jobs-testing-chrome` image is removed and test/verify jobs now default to `jobs-default`: if your tests need a browser, point `test.jobImage` (or `verify.jobImage`) at an image that carries one — best the official playwright image matched to your dependency, e.g. `jobImage: "mcr.microsoft.com/playwright:v1.49.0-jammy"` — or declare a project image via `images`. The failure mode without this is a loud "browser not found" in the test job.

`jobs-default` itself is trimmed: base `node:22` (was the EOL `node:18`) with node 20/22/24 pre-installed (was 12–24). Pre-installed node versions are a cache, not a contract — a job with an `.nvmrc` always gets its version (pre-warmed or `nvm install`ed at runtime), a job without one runs the shipped LTS base, which may bump in future minors. Pin with an `.nvmrc` if your project depends on a specific node version.
