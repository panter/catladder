# Google Cloud Run

Google Cloud Run is a container hosting. It is easy to use and provides sane defaults, e.g. it scales down to 0 when your app is not used, which makes it a cost efficient option also for review-apps and dev-apps.

Its compatible with all kinds of runtimes and frameworks as it can run any Docker image.

Make sure to follow the [CLOUD READY](../recipies/CLOUD_READY.md) principles as they are in particular important for cloud run.

## Configuration

In your catladder.ts set the deploy type to `google-cloud-run`:

```typescript
const config: Config = {
  customerName: "pan",
  appName: "myapp",
  components: {
    api: {
      dir: "api",
      build: {
        // ...
      },
      deploy: {
        type: "google-cloudrun",
        projectId: "your-google-cloud-project",
        region: "europe-west6",
      },
    },
  },
};
```

**Whenever you do a change to this config, run this command in catladder-cli:**

```
🐱 $ project-setup


```

this will setup the required service-accounts, apis, etc.
_Make Sure that you are logged in with `gcloud` and have access to `your-google-cloud-project`_

## Cloud SQL support

1. Create a cloudSQL instance in the same project `your-google-cloud-project` (if you need support for cross-project apps, please raise an issue as this would need an additional service account). Copy the password. **make sure the password does not contain special chars (this is a limitation in gitlab currently)**
2. Add this to your deploy config:

```typescript
deploy: {
  type: "google-cloudrun",
  projectId: "your-google-cloud-project",
  region: "europe-west6",
  cloudSql: {
    type: 'unmanaged', // only type currently
    instanceConnectionName: 'your-google-cloud-project:europe-west6:instance-name', // <-- copy it directly from the cloud sql console
  }
}
```

3. run `project-setup` and `project-config-secrets`

Catladder will automatically create the databases on this instance. You can reuse the same instance for multiple apps as the database-names contain the full app name and should not clash.

## Jobs and migrations

You can declare jobs too. Those jobs are either for one-time work that needs to be done or for recurring tasks on a schedule (cronjobs):

```typescript
deploy: {
  type: "google-cloudrun",
  projectId: "your-google-cloud-project",
  region: "europe-west6",
  jobs: {
    myjob: {
      command: "your-command", // <-- by default it will use the same image as your app, but with another command/entrypoint
      when: "preDeploy", // or "schedule", "postDeploy", "manual"
    }
  }
}
```

Make sure to checkout this example https://git.panter.ch/catladder/test-projects/cloudrun-prisma. This also describes how to trigger a job from within another cloud run app.

## Custom domains

There is no built-in support for custom domains in catladder, but you can setup custom domains manually.
Follow these guide: https://cloud.google.com/run/docs/mapping-custom-domains

Some hints:

- Google load balancer is very powerful, but expensive in comparison (at least 20 CHF per month). Recommended for bigger projects.
- Firebase hosting is a cheaper alternative. You can use firebase hosting without actually using all other features of it. However if you have a static app (E.g. frontend) as well, you might consider it as static hosting. [See this example](https://git.panter.ch/klassenlager2021/fonsi-2-0)
