---
sidebar_position: 4
---

# Deploy

The `deploy` config of a component decides where and how it is deployed.
Every deploy type works on both CI backends unless noted otherwise.

| Deploy type                             | What it does                                                                    |
| --------------------------------------- | ------------------------------------------------------------------------------- |
| [`google-cloudrun`](./google_cloud_run) | container hosting on Google Cloud Run — services, jobs, worker pools, Cloud SQL |
| [`npmPackage`](./npm_package)           | publishes the component to an npm registry                                      |
| [`pages`](./pages)                      | publishes a static site on GitLab or GitHub pages                               |
| [`custom`](./custom)                    | your own deploy script                                                          |
| [`dockerTag`](./custom#dockertag)       | tags the built image for an external deployment                                 |
| [`kubernetes`](./kubernetes)            | Helm deployment to a Kubernetes cluster (deprecated)                            |

A component without a `deploy` config is built and tested, but never
deployed.
