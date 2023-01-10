## Development

### Pipeline

### Snapshot tests

there are some [examples](../pipeline/examples/) that double for snapshot-testing.

Please add more examples there. If you need to update the snapshots, run `yarn test:update` in the root directory

#### Create a pipeline locally

1. Build catladder: `yarn build`
1. Provide a `catladder.ts` in the current working directory and run one of the following:
   - MR: `CI_MERGE_REQUEST_ID=123 pipeline/bin/catladder-gitlab.js`
   - Main branch: `CI_DEFAULT_BRANCH=main CI_COMMIT_BRANCH=main pipeline/bin/catladder-gitlab.js`
   - Release: `CI_COMMIT_TAG=v0.0.1 pipeline/bin/catladder-gitlab.js`

...and a `__pipeline.yml` will magically appear - enjoy deciphering it 😉
