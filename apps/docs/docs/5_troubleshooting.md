---
sidebar_position: 5
sidebar_label: Troubleshooting
---

# Troubleshoot Common Errors

## First aid: `catladder project doctor`

`catladder project setup` provisions infrastructure for the config *at the time it runs*. Config edits that change required infrastructure (e.g. adding `cloudSql` to a component implies the `roles/cloudsql.admin` IAM role) drift silently until a ci job hits a 403.

```bash
catladder project doctor              # whole project
catladder project doctor <component>  # narrow the per-component checks
```

The doctor is **read-only** and compares the state the current config implies against what is actually provisioned:

- catladder store entries (gcloud project numbers) for all cloud run projects
- gitlab setup outputs: semantic-release token (incl. expiry), `GL_TOKEN` variable, `catladder` topic, registry deploy token
- per component/env: deploy service account exists and carries all config-implied IAM roles; required gcloud services enabled; artifacts registry present
- github: every secret/variable the generated workflows reference exists in its github environment (names only — github secrets are write-only)

Each problem is reported with the command that heals it (usually `catladder project setup <component>` or `catladder project secrets-sync-github`).

## `Error: UPGRADE FAILED: another operation (install/upgrade/rollback) is in progress`

Might happen if you cancel the deploy job.

- `helm list --namespace <your namespace> --all`
- Check if there is a "pending upgrade" and check the revision number where status is _deployed_
- then `helm rollback --namespace <your namespace> <name> [<deployed-revision-number>]` to roll back to the previous version (the revision number is only required if the deployed revision is **not** the second last version)
- trigger the update again

## Yarn Build fails due to `node_modules` Content

The `node_modules` is cached between all pipeline jobs, which means more packages are present than what is in the lockfile. Yarn should handle this well.

But if you suspect the build fails due to the content of `node_modules` try to [clear the CI/CD cache manually](https://docs.gitlab.com/ee/ci/caching/#clear-the-cache-manually) and retry the job(s).

## Expired GitLab token

1) create new personal access token with `api` scope https://git.panter.ch/-/user_settings/personal_access_tokens
2) change it in  `~/.config/catladder/preferences.yml`

---

Please add more!
