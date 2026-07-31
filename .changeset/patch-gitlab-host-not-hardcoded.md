---
"catladder": patch
---

catladder no longer assumes it runs against one specific GitLab instance. The host was hardcoded as `https://git.panter.ch` in the security-audit commands, in catci, in the `project ci` job-trace call and in the `gitlabUrl` of the generated semantic-release config — so on any other GitLab those calls silently talked to the wrong server. They now resolve the instance from `CI_SERVER_URL` in CI and from the git remote locally, and the semantic-release GitLab plugin derives its url from the CI environment like it is meant to.

Also removes the GitLab Visual Review toolbar from the kubernetes helm chart: it was off by default, hardcoded the same host, and the GitLab feature behind it was removed upstream in 17.0.
