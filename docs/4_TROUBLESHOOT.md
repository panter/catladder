# Troubleshoot Common Errors

## My pipeline no longer works, you broke it!

Take a deep breath - there is a (temporary) way out:

1. Identify a working version
    - In the last pipeline in your project that worked check the job log of the _create-pipeline_ job and make a note of the output:
      `catladder verson vX-Y-Z-<sha>`
    - or check the [releases](https://git.panter.ch/catladder/catladder/-/releases) page
1. Pin the version in your `.gitlab-ci.yml` to that specific version:
    ```yaml
    include: https://git.panter.ch/api/v4/projects/catladder%2Fcatladder/packages/generic/ci-includes/vX-Y-Z/gitlab-ci.yml
    ```
1. Create a issue or even better a merge request
1. Don't forget to switch back to the `.../vX/gitlab-ci.yml` again!

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

