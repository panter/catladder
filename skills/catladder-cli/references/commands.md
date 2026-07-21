# catladder CLI command reference

<!-- rendered from the command definitions by
     cli/src/scripts/generateCliSkillReference.ts — do not edit -->

All commands run non-interactively as `yarn catladder <command> ...`;
see SKILL.md for how to pass inputs.

## `catladder cloudsql restore-db`

restore a db from one source to another target

- `--source <value>`: Source instance (connection string or 'local')?
- `--source-local-port <value>`: Local Port for source? (default: 5432)
- `--source-username <value>`: Source Username? (default: "postgres")
- `--source-password <value>`: Source Password?
- `--source-db-name <value>`: Source DB name?
- `--target <value>`: Target INSTANCE (connection string or 'local')?
- `--target-local-port <value>`: Local Port for target? (default: 5432)
- `--target-username <value>`: Target Username? (default: "postgres")
- `--target-password <value>`: Target Password?
- `--target-db-name <value>`: Target DB name?

## `catladder fun dadjoke`

something for jonas.

## `catladder fun starwars`

Long time ago... in a galaxy far far away...

## `catladder k8s current-context`

show current kubernetes context

## `catladder k8s get-shell [namespace]`

get a shell to a pod in the environment

- `namespace` (positional): kubernetes namespace
- `--pod-name <value>`: Which pod?

## `catladder k8s list-namespaces`

list all namespaces

## `catladder k8s list-pods [namespace]`

list all pods of namespace

- `namespace` (positional): kubernetes namespace

## `catladder k8s list-secrets [namespace]`

show secrets

- `namespace` (positional): kubernetes namespace

## `catladder k8s port-forward [namespace]`

start port-forwarding

- `namespace` (positional): kubernetes namespace
- `--pod-name <value>`: Which pod?
- `--local-port <value>`: Local port:
- `--remote-port <value>`: Remote port:

## `catladder k8s stop-portforward [name]`

stop a running port forward

- `name` (positional): port forward name

## `catladder k8s trigger-cronjob [namespace]`

trigger cronjob

- `namespace` (positional): kubernetes namespace
- `--job-name <value>`: Which cronjob?

## `catladder project ci job-log`

Show a job's log

- `--job-name <value>`: Which job?

## `catladder project ci job-open`

Open a Job

- `--job-name <value>`: Which job?

## `catladder project cloudsql proxy [envComponent]`

proxy to cloud sql db

- `envComponent` (positional): environment:component
- `--local-port <value>`: Local port: (default: 54320)

## `catladder project cloudsql restore-db`

restores a project db from one source to another target

- `--source <value>`: Source instance?
- `--target <value>`: target env?
- `--confirm-instance <value>`: confirm:

## `catladder project config-secrets [envComponent]`

setup/update secrets stored in pass

- `envComponent` (positional): environment:component

## `catladder project doctor [component]`

Checks for drift between the config and the provisioned infrastructure (read-only): service accounts, IAM roles, gitlab tokens, github secrets, store entries.

- `component` (positional): component name

## `catladder project env-vars [envComponent]`

list env vars

- `envComponent` (positional): environment:component

## `catladder project k8s delete [envComponent]`

deletes a environment of a project (it deletes the namespace)

- `envComponent` (positional): environment:component

## `catladder project k8s delete-pods [envComponent]`

delete / restart pods

- `envComponent` (positional): environment:component
- `--selected-pod-names <value>`: Which pods to delete / restart ?

## `catladder project k8s get-shell [envComponent]`

get a shell to a pod in the environment

- `envComponent` (positional): environment:component
- `--pod-name <value>`: Which pod?

## `catladder project k8s list-pods [envComponent]`

list pods of local project

- `envComponent` (positional): environment:component

## `catladder project k8s namespace [envComponent]`

show namespace of local project

- `envComponent` (positional): environment:component

## `catladder project k8s pause [envComponent]`

halts all running pods (scales to 0)

- `envComponent` (positional): environment:component

## `catladder project k8s trigger-cronjob [envComponent]`

trigger cronjob

- `envComponent` (positional): environment:component
- `--job-name <value>`: Which cronjob?

## `catladder project logs open [envComponent]`

open logs for a component (Google Cloud Logging)

- `envComponent` (positional): environment:component

## `catladder project mongo destroy-member [envComponent]`

DESTROY a member of a replicaset in order to reinitialize it

- `envComponent` (positional): environment:component
- `--pod-name <value>`: Which pod?

## `catladder project mongo get-shell [envComponent]`

get a shell to a mongodb in the environment

- `envComponent` (positional): environment:component
- `--pod-name <value>`: Which pod?

## `catladder project mongo port-forward [envComponent]`

port forward to a mongodb

- `envComponent` (positional): environment:component
- `--pod-name <value>`: Which pod?
- `--local-port <value>`: Local port: (default: 30000)

## `catladder project open env [envComponent]`

open the live environment

- `envComponent` (positional): environment:component

## `catladder project open git`

open the repo on gitlab / github in your browser

## `catladder project port-forward [envComponent]`

start port-forwarding

- `envComponent` (positional): environment:component
- `--pod-name <value>`: Which pod?
- `--local-port <value>`: Local port:
- `--remote-port <value>`: Remote port:
- `--mr <value>`: Which mr

## `catladder project renew-token`

Configures the project access token for semantic release.

## `catladder project secrets-clear-backups`

clears all backups

- `--keep <value>`: How many backups should we keep? (default: 1)

## `catladder project secrets-sync-github [repo] [env]`

copies all secrets from the vault to github repo secrets (same names), for the github pipeline

- `repo` (positional): github repository (owner/name)
- `env` (positional): only sync these environments (comma-separated, e.g. review,dev) — github allows at most 100 repo secrets

## `catladder project security-evaluate`

evaluate project's security audit document

## `catladder project setup [component]`

Initializes all environments and creates required resources, service accounts, etc.

- `component` (positional): component name

## `catladder project worktime`

show the total worktime that you spent on a project

## `catladder security audit ci-job [path] [token] [mainBranch] [projectId] [userId]`

Evaluates security audit document. Creates MR with template if missing.

- `path` (positional): path to project root
- `token` (positional): GitLab token (api scope)
- `mainBranch` (positional): main branch name
- `projectId` (positional): GitLab project ID
- `userId` (positional): GitLab user ID (assignee)

## `catladder security audit create [token] [mainBranch] [projectId] [userId]`

Creates a MR with the latest security audit template document

- `token` (positional): GitLab token (api scope)
- `mainBranch` (positional): main branch name
- `projectId` (positional): GitLab project ID
- `userId` (positional): GitLab user ID (assignee)

## `catladder security audit evaluate [path]`

Evaluates security audit document in given path

- `path` (positional): path to project root
