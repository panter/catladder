---
sidebar_label: n8n on Cloud Run
---

# Deploying n8n on Google Cloud Run

[n8n](https://n8n.io/) is a workflow automation tool that lets you connect services and build automations through a visual editor. This recipe shows how to deploy n8n on Google Cloud Run using catladder, with Cloud SQL for persistence.

## Example config

See the full example in [`pipeline/examples/cloud-run-n8n.ts`](https://github.com/panter/catladder/blob/main/pipeline/examples/cloud-run-n8n.ts).

## Key configuration choices

### Pre-built image with `build: false`

n8n provides official Docker images. Instead of building our own, we reference the upstream image directly:

```ts
build: false,
deploy: {
  service: {
    image: "n8nio/n8n:2.12.0",
  },
},
```

Setting `build: false` skips the build stage entirely and uses the specified image for deployment.

### Cloud SQL for persistence

n8n requires a database to store workflows, credentials, and execution history. We use Cloud SQL (PostgreSQL) via the Unix socket proxy:

```ts
cloudSql: {
  type: "unmanaged",
  instanceConnectionName: "projectId:region:instancename",
  dbBaseName: "n8n",
},
```

The `unmanaged` type means the Cloud SQL instance is provisioned outside of catladder. The Cloud Run service connects via the built-in Cloud SQL proxy socket at `/cloudsql/<instanceConnectionName>`.

### Single instance (`minInstances: 1`, `maxInstances: 1`)

n8n is a stateful application — it maintains in-memory state for active workflow executions. It cannot be horizontally scaled without a queue-based architecture. Setting both min and max instances to 1 ensures exactly one instance is running at all times:

```ts
minInstances: 1,
maxInstances: 1,
```

### `noCpuThrottling: true`

By default, Cloud Run throttles CPU when a container is not handling a request. Since n8n runs background workflows (cron triggers, webhook listeners, long-running executions), it needs CPU allocated at all times:

```ts
noCpuThrottling: true,
```

### `sessionAffinity: true`

Ensures that requests from the same client are routed to the same container instance. This is important for the n8n editor UI to maintain a consistent connection:

```ts
sessionAffinity: true,
```

### gen2 execution environment

The gen2 execution environment provides full Linux compatibility, which is needed for n8n's process management and networking:

```ts
executionEnvironment: "gen2",
```

### Environment variables

The config uses `vars` to set n8n's database connection and application settings. Secret values like `N8N_ENCRYPTION_KEY` are managed as secrets, while public variables configure the database connection and n8n behavior:

```ts
vars: {
  secret: ["N8N_ENCRYPTION_KEY"],
  public: {
    N8N_PORT: "8080",
    DB_TYPE: "postgresdb",
    DB_POSTGRESDB_HOST: "/cloudsql/${CLOUD_SQL_INSTANCE_CONNECTION_NAME}",
    // ...
  },
},
```

## See also

- [Being "Cloud Ready"](./CLOUD_READY.md) — general principles for cloud-native apps (note: n8n intentionally deviates from some of these since it is stateful)
- [Cloud Run deploy type documentation](../deploy-types/google-cloud-run)
