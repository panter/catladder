# Google Cloud Run

Google Cloud Run is a container hosting.
It is easy to use and provides sane defaults,
e.g. it scales down to 0 when your app is not used,
which makes it a cost-efficient option as well for review-apps and dev-apps.

It's compatible with all kinds of runtimes and frameworks, as it can run any Docker image.

Make sure to follow the [CLOUD READY](../recipies/CLOUD_READY.md) principles, as they are in particular important for cloud run.

## Configuration

In your `catladder.ts` set the deploy type to `google-cloud-run`:

```ts
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

**Whenever you make a change to this config, run this command in catladder-cli:**

```
🐱 $ project-setup


```

This will set up the required service-accounts, APIs, etc.
_Make Sure that you are logged in with `gcloud` and have access to `your-google-cloud-project`_

## Cloud SQL support

1. Create a CloudSQL instance in the same project `your-google-cloud-project` (if you need support for cross-project apps, please raise an issue, as this would need an additional service account).  
   Copy the password. **Make sure the password does not contain special chars (this is a limitation in GitLab currently).**
2. Add this to your deploy config:

```ts
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

Catladder will automatically create the databases on this instance. You can reuse the same instance for multiple apps, as the database-names contain the full app name and should not clash.

To use a DB from another project, refer to this https://stackoverflow.com/a/70770872/1463534

## Jobs and migrations

You can declare jobs too. Those jobs are either for one-time work that needs to be done or for recurring tasks on a schedule (cronjobs):

```ts
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

Make sure to check out this example https://git.panter.ch/catladder/test-projects/cloudrun-prisma. This also describes how to trigger a job from within another cloud run app.

## Custom domains

There's no built-in support for custom domains in catladder, but you can set up custom domains manually.  
Follow these guide: https://cloud.google.com/run/docs/mapping-custom-domains

Some hints:

- Google's load balancer is powerful, but expensive in comparison (at least 20 CHF per month).  
  Recommended for bigger projects.
- Firebase hosting is a cheaper alternative. You can use firebase hosting without actually using all other features of it.  
  However, if you have a static app (E.g. frontend) as well, you might consider it as static hosting.

### Custom Domains using firebase

Firebase can be used as a cheap alternative to Google's load balancer to add custom domains to your cloud run app.

Preparation work:

- make sure you have access to the DNS of your domain
- make sure your app is deployed to production and works correctly there

1. Create a firebase project. When asked for the name, let the dropdown load. It will show you existing google cloud projects. Make sure to select the same project as your cloud run app.
2. under hosting, add a custom domain. Follow the instructions. You will need to add a TXT record to your DNS. This is to verify that you own the domain. If you migrate from an exising prod-app, make sure to use the advanced method.
3. Firebase will create a certificate for it, once you setup the DNS correctly. This can take up to 24h.
4. in the meantime, install firebase tools: `npm i -g firebase-tools`
5. Login to firebase: `firebase login`
6. You need to create a .firebaserc file. [See this example](https://git.panter.ch/klassenlager2021/fonsi-2-0). You can also use `firebase init` to create it with a wizard. This example has multiple hosting targets, so its still worth to check it out
7. Create a firebase.json where the hosting is setup, again look at this [example](https://git.panter.ch/klassenlager2021/fonsi-2-0)
8. Make sure your cloud run app is deployed to production and works correctly there
9. Run `firebase deploy --only hosting` to deploy the hosting
10. if your certificate from step 2 is ready, you can change the A-record of your domain to point to the firebase hosting IP. You can find it in the firebase console under hosting.

Some tips:

- if you migrate from an existing prod-app, make sure to use the advanced method in step 2, which first generates the certificate. Changes in any DNS can take time to propagate and is not immediatly active for all users on the globe. If you use the simple method, which is change either CNAME or A-record, you might end up with a certificate error.
- You can have multiple domains on the same firebase project. This can be used for apps with dedicated frontend and api service and you can also add custom domains for staging
- no changes are needed in catladder. It will still deploy to cloud run, but firebase will route the traffic to it. You can still use the cloud run url to access your app.
- Still make sure to set `host` in catladder.ts of your prod environment, so that your services know the url where there are hosted from (ROOT_URL)

## Migration from kubernetes to cloud run

Preparations:

- make sure you have access to the DNS of your domain (see Custom domains chapter)
- Check the [CLOUD READY](../recipies/CLOUD_READY.md) principles and make sure your app is cloud ready
- Check whether your app use background workers, cronjobs and one-time jobs to understand the cost structure
- Be aware of the costs and check whether existing hosting costs are higher or lower than your estimations

Steps:

1. Change the catladder.ts config to use `google-cloud-run` as deploy type. Don't forget to alter all jobs as well.
2. run `project-setup` in catladderc-li
3. Push and make sure it works on your review-branch. Test it thouroughly
4. Merge and create a release. Wait before you deploy to production.
5. If you have cronjobs and background workers, you need to manually remove them from kubernetes because once you deploy the app to production, the new cronjobs and workers will start to operate as well.
6. Deploy it to production. Make sure it works correctly by accessing it via the cloud run url. If you have custom domains, you can already set them up, but don't change the DNS yet.
7. Change the DNS to point the public prod domain to the custom domain (firebase) or load balancer.
8. Once DNS is propagated (can take up to 24h), you can safely delete the old kubernetes namespace as no traffic should land there anymore.

### Considerations

#### min instances and scaling behaviour

Cloud run scales down to 0 when your app is not used. This is cost efficient, but lead to "cold starts" when someone access your app after a while. A typical node app is not so fast with starting, so cold start is often too long for a user to wait.

Having 0 min instances is therefore a recommended option for all non prod-apps.

For prod-apps, consider setting minInstances to 1. Be aware of the cost implications.

#### Max instances

Cloud run scales up to 100 instances by default. This is a lot and can lead to high costs. Consider setting a max instance limit.

Bursts can happen if you are target of DDOS attacks.

#### Cronjobs and one time jobs

Cronjobs and one time jobs (e.g. migrations) are supported by catladder and cloud-run. They are implemeted by using a cloud run job and setting up a cloud runner, see Jobs and migrations chapter.

If you have a cronjob that runs more often then every 10min, you might consider to use a background worker instead as this is more cost efficient.

#### Background workers

Background workers are supported by catladder and cloud-run, but there are comparably expensive, since you need to always allocate cpu and memory for them.

Check the example [cloud-run-meteor-with-worker](../../pipeline/examples/cloud-run-meteor-with-worker.ts) to see how to set it up.

Consider migrating away from background workers to either cronjobs are asynchronous tasks using Cloud Tasks.

#### MongoDb

we supported mongodb in kubernetes by using a helm chart. This is not supported in cloud run. You can use a managed mongodb service, e.g. mongodb atlas.
