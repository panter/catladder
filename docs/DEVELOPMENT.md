## Development

### Pipeline

### Snapshot tests

There are some [examples](../pipeline/examples/) that double for snapshot-testing.

Please add more examples there. If you need to update the snapshots, run `yarn test:update` in the root directory.

#### Create a pipeline locally

1. Build catladder: `yarn build`
1. Provide a `catladder.ts` in the current working directory and run one of the following:
   - MR: `CI_MERGE_REQUEST_ID=123 pipeline/bin/catladder-gitlab.js`
   - Main branch: `CI_DEFAULT_BRANCH=main CI_COMMIT_BRANCH=main pipeline/bin/catladder-gitlab.js`
   - Release: `CI_COMMIT_TAG=v0.0.1 pipeline/bin/catladder-gitlab.js`

…and a `__pipeline.yml` will magically appear — enjoy deciphering it 😉

#### Create quickly a pipeline from catladder.ts

This script runs the exact Docker image that is used by GitLab CI.

`cl-gitlab.sh`
```bash
#!/bin/bash
LATEST_CATLADDER_DOCKER_IMAGE=$(curl -L -s https://git.panter.ch/api/v4/projects/catladder%2Fcatladder/packages/generic/ci-includes/v1/gitlab-ci.yml | head -n 1 | sed -En "s/image: (.*)/\1/p")
docker run --user=$(echo $UID) --workdir=/app -v $(pwd):/app -e CI_MERGE_REQUEST_ID=999999 -it $LATEST_CATLADDER_DOCKER_IMAGE catladder-gitlab
```

