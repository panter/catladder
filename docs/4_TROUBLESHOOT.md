# Troubleshoot Common Errors

## `Error: UPGRADE FAILED: another operation (install/upgrade/rollback) is in progress`

might happen if you cancel the deploy job.

- `helm list --namespace <your namespace> --all`
- check if there is a "pending upgrade" and check the revision number where status is _deployed_
- then `helm rollback --namespace <your namespace> <name> [<deployed-revision-number>]` to rollback to the previous version (the revision number is only required if the deployed revision is **not** the second last version)
- trigger the update again

---

Please add more!
