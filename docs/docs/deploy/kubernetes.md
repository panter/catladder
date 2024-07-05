---
sidebar_position: 4
---

# Kubernetes (deprecated)

TODO

The `kubernetes` deploy-type uses helm to deploy the app to a Kubernetes cluster.

It was the first catladder deploy type, highly opinionated and has many features, but is only recommended for certain types of apps.
If possible, use serverless deployment types like `google-cloud-run`

## Swiss Cluster Deployments (Panter specific)

### Requirements

1. Basic setup and understanding for Kubernetes Administration (https://git.panter.ch/panter/wiki/-/wikis/administration/kubernetes)
2. Access rights to cluster `skynet-swiss` (ask #technik if this is missing)
3. Switch to project `skynet-swiss` in Google Cloud Console (https://console.cloud.google.com/)
4. Copy command for connecting to cluster ch-staging (e.g. `gcloud container clusters get-credentials...`)

### Deployment files

You need two files in your repository's root folder: `catladder.ts` and `.gitlab-ci.yml`.

In the `.gitlab-ci.yml` file, you can define all the includes you need:

```yaml
include: https://git.panter.ch/api/v4/projects/catladder%2Fcatladder/packages/generic/ci-includes/v1/gitlab-ci.yml
```

The `catladder.ts` file defines the whole deployment for Kubernetes. 

Here's a short example file:

```ts title="catladder.ts"
import type {
  Config,
  DeployConfigKubernetesCluster,
} from "@catladder/pipeline";

const PROD_CLUSTER: DeployConfigKubernetesCluster = {
  type: "gcloud",
  name: "ch-production",
  projectId: "skynet-swiss",
  region: "europe-west6-a",
  domainCanonical: "panter.swiss",
};

const DEV_CLUSTER: DeployConfigKubernetesCluster = {
  type: "gcloud",
  name: "ch-staging",
  projectId: "skynet-swiss",
  region: "europe-west6-a",
  domainCanonical: "panter.dev",
};
const config: Config = {
  customerName: "EXAMPLE CUSTOMER NAME (always 3 letters, lowercase. e.g.: ihz, pvl, vps etc.)",
  appName: "EXAMPLE APP NAME (always separated by dashes, lowercase, e.g.: ihz-member-app, pvl-cyclomania-web etc.)",
  components: {
    // 👉 here you define all the needed, components
    web: {
      // 👉 define the location for the app to build
      dir: ".",
      build: {
        type: "node",
      },
      deploy: {
        type: "kubernetes",
        cluster: DEV_CLUSTER,
      },
      env: {
        prod: {
          deploy: {
            type: "kubernetes",
            cluster: PROD_CLUSTER,
          },
        },
      },
      vars: {
        // 👉 define public vars
        public: {},
        // 👉 define the secrets, which will be afterwards set via catladder command project-config-secrets
        secret: ["HUB_API_URL"],
      },
    },
    api: {
      dir: "./api/
      build: {
        ...
      },
      ...
    }
  },
};

export default config;

```
