# catladder 🐱 🔧

panter cli tool for kubernetes

## Install

`yarn global add @panter/catladder`

or npm users

`npm install -g @panter/catladder`

## Getting started
You'll need
- Google Cloud SDK ([see installation instructions](https://cloud.google.com/sdk/docs/install))
- Kubectl ([see installation instructions](https://kubernetes.io/docs/tasks/tools/))
- Cloud SQL Auth proxy ([see installation instructions](https://cloud.google.com/sql/docs/postgres/sql-proxy#install))
- Bitwarden CLI ([see installation instructions](https://bitwarden.com/help/article/cli/))

Afterwards you need to connect to your cluster, e.g. `gcloud container clusters get-credentials clustername --zone google-zone --project google-project-id`
In most cases you'll find the details on the Google Cloud [cluster overview ](https://console.cloud.google.com/kubernetes/list?project=skynet-164509)

It just works™

## Preferences

catladder stores some preferences in `~/.catladder/preferences.yml` in case you want to change settings.

## Contribution

Check the docu [here](/CONTRIBUTING.md).
