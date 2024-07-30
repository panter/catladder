---
sidebar_position: 5
sidebar_label: Troubleshooting
---

# Troubleshoot Common Errors

## `Error: UPGRADE FAILED: another operation (install/upgrade/rollback) is in progress`

Might happen if you cancel the deploy job.

- `helm list --namespace <your namespace> --all`
- Check if there is a "pending upgrade" and check the revision number where status is _deployed_
- then `helm rollback --namespace <your namespace> <name> [<deployed-revision-number>]` to roll back to the previous version (the revision number is only required if the deployed revision is **not** the second last version)
- trigger the update again

## Yarn Build fails due to `node_modules` Content

The `node_modules` is cached between all pipeline jobs, which means more packages are present than what is in the lockfile. Yarn should handle this well.

But if you suspect the build fails due to the content of `node_modules` try to [clear the CI/CD cache manually](https://docs.gitlab.com/ee/ci/caching/#clear-the-cache-manually) and retry the job(s).

---

Please add more!
