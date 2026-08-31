---
"catladder": patch
---

`project setup` now stores the credentials it provisions — the gcloud deploy service account key, the kubernetes deploy credentials — through the secrets vault and from there to every enabled CI backend, exactly like any other secret. Until now it wrote them straight into GitLab project variables: on a project without a GitLab pipeline the setup of a cloud run or kubernetes component died with `Error: not found` (a 404 from the GitLab API against a host that is not a GitLab), and on a project with a bitwarden vault the credentials silently never reached the vault. The GitLab registry deploy token that kubernetes setup creates is now skipped when no GitLab pipeline is enabled, and a 404 from the GitLab API finally says which call failed against which host.
