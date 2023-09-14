# catladder 🐱 🔧

Panter cli tool for Kubernetes.

## Install

```sh
# yarn users
yarn global add @catladder/cli
# npm users
npm install -g @catladder/cli
```

> **Note**: If you have [@catladder/pipeline](https://www.npmjs.com/package/@catladder/pipeline) installed, upgrade it to >=4.0.0 before installing [@catladder/cli](https://www.npmjs.com/package/@catladder/cli).

## Getting started

You'll need:

- Google Cloud SDK ([see installation instructions](https://cloud.google.com/sdk/docs/install))
- Kubectl ([see installation instructions](https://kubernetes.io/docs/tasks/tools/))
- Cloud SQL Auth proxy ([see installation instructions](https://cloud.google.com/sql/docs/postgres/sql-proxy#install))

Afterwards, you need to connect to your cluster, e.g. `gcloud container clusters get-credentials clustername --zone google-zone --project google-project-id`
In most cases, you'll find the details on the Google Cloud [cluster overview ](https://console.cloud.google.com/kubernetes/list?project=skynet-164509)

It just works™

## Preferences

Catladder stores some preferences in `~/.catladder/preferences.yml` in case you want to change settings.

## Contribution

Check the documentation [here](https://git.panter.ch/catladder/catladder/-/tree/main/cli/CONTRIBUTING.md).
