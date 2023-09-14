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

## Create quickly a __pipeline.yml from catladder.ts

If you'd like to quickly create `__pipeline.yml` on a project:

`cl-gitlab.sh`
```bash
#!/bin/bash
LATEST_CATLADDER_DOCKER_IMAGE=$(curl -L -s https://git.panter.ch/api/v4/projects/catladder%2Fcatladder/packages/generic/ci-includes/v1/gitlab-ci.yml | head -n 1 | sed -En "s/image: (.*)/\1/p")
docker run --user=$(echo $UID) --workdir=/app -v $(pwd):/app -e CI_MERGE_REQUEST_ID=999999 -it $LATEST_CATLADDER_DOCKER_IMAGE catladder-gitlab
```

