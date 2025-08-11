---
sidebar_position: 1
---

# Google Cloud Run

Google Cloud Run is a container hosting.
It is easy to use and provides sane defaults,
e.g. it scales down to 0 when your app is not used,
which makes it a cost-efficient option as well for review-apps and dev-apps.

It's compatible with all kinds of runtimes and frameworks, as it can run any Docker image.

Make sure to follow the [CLOUD READY](/docs/recipies/CLOUD_READY) principles, as they are in particular important for cloud run.

## Configuration

In your `catladder.ts` set the deploy type to `google-cloud-run`:

```ts title="catladder.ts"
const config = {
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
} satisfies Config;
```

**Whenever you make a change to this config, run this command in catladder-cli:**

```sh
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

Jobs are either for one-time work that needs to be done or for recurring tasks on a schedule (cronjobs)

### Execute jobs before or after deployment

```ts
deploy: {
  type: "google-cloudrun",
  projectId: "your-google-cloud-project",
  region: "europe-west6",
  jobs: {
    myjob: {
      command: "your-command", // <-- by default it will use the same image as your app, but with another command/entrypoint
    }
  },
  execute: {
    myjobexecution: { // <-- you can chose any name here. If you want to overwride an execution, you can use the same name
      type: "job",
      job: "myjob",
      when: "preDeploy", // can also be "postDeploy", "preStop", "postStop"
      waitForCompletion: true, // <-- if true, the deployment will wait until the job is finished, defaults to false
    }
  }
}
```

### Execut jobs on a schedule

You can run a cloud run job on a schedule:

```ts
deploy: {
  type: "google-cloudrun",
  projectId: "your-google-cloud-project",
  region: "europe-west6",
  jobs: {
    ["send-emails"]: {
      command: "send-emails",
    }
  },
  execute: {
    "send-newsletter": {
      type: "job",
      job: "send-emails",
      args: ["--newsletter"], // <-- optionally you can specify arguments
      when: "schedule",
      schedule: "0 0 * * *", // <-- cron syntax, here: every day at midnight
    }
  }
}
```

You can also call an http endpoint on a schedule. This is useful if you have a background worker that can be triggerd by an http request.

```ts
deploy: {
  type: "google-cloudrun",
  projectId: "your-google-cloud-project",
  region: "europe-west6",
  jobs: {
    ["send-emails"]: {
      command: "send-emails",
    }
  },
  execute: {
    "send-newsletter": {
      type: "http",
      url: "${ROOT_URL}/send-emails", // <-- you can use variables here
      when: "schedule",
      method: "GET",
      schedule: "0 0 * * *", // <-- cron syntax, here: every day at midnight
    }
  }
}
```

### Execute a job from within your app

Check out this example https://git.panter.ch/catladder/test-projects/cloudrun-prisma.

## Custom domains

There's no built-in support for custom domains in catladder, but you can set up custom domains manually.  
Follow these guide: https://cloud.google.com/run/docs/mapping-custom-domains

Some hints:

- Google's load balancer is powerful, but expensive in comparison (at least 20 CHF per month).  
  Recommended for bigger projects.
- Firebase hosting is a cheaper alternative. You can use firebase hosting without actually using all other features of it.  
  Only the specially-named `__session` cookie is permitted to pass through to the execution of your app (see [docs](https://firebase.google.com/docs/hosting/manage-cache#using_cookies)).
  However, if you have a static app (E.g. frontend) as well, you might consider it as static hosting.
- [Cloud Run domain mapping](https://cloud.google.com/run/docs/mapping-custom-domains#run) is the third option, but it's not (yet) available in the Zurich region

### Custom Domains using firebase

Firebase can be used as a cheap alternative to Google's load balancer to add custom domains to your cloud run app.

Preparation work:

- make sure you have access to the DNS of your domain
- make sure your app is deployed to production and works correctly there

1. Create a firebase project. When asked for the name, let the dropdown load. It will show you existing google cloud projects. Make sure to select the same project as your cloud run app.
2. under hosting, add a custom domain. Follow the instructions. You will need to add a TXT record to your DNS. This is to verify that you own the domain. If you migrate from an existing prod-app, make sure to use the advanced method.
3. Firebase will create a certificate for it, once you've set up the DNS correctly. This can take up to 24h.
4. in the meantime, install firebase tools: `npm i -g firebase-tools`
5. Login to firebase: `firebase login`
6. You need to create a .firebaserc file. [See this example](https://git.panter.ch/klassenlager2021/fonsi-2-0). You can also use `firebase init` to create it with a wizard. This example has multiple hosting targets, so its still worth to check it out
7. Create a `firebase.json` where the hosting is set up, again look at this [example](https://git.panter.ch/klassenlager2021/fonsi-2-0)
8. Make sure your cloud run app is deployed to production and works correctly there
9. Run `firebase deploy --only hosting` to deploy the hosting
10. if your certificate from step 2 is ready, you can change the A-record of your domain to point to the firebase hosting IP. You can find it in the firebase console under hosting.

Some tips:

- if you migrate from an existing prod-app, make sure to use the advanced method in step 2, which first generates the certificate. Changes in any DNS can take time to propagate and is not immediately active for all users on the globe. If you use the simple method, which is change either CNAME or A-record, you might end up with a certificate error.
- You can have multiple domains on the same firebase project. This can be used for apps with dedicated frontend and api service and you can also add custom domains for staging
- no changes are needed in catladder. It will still deploy to cloud run, but firebase will route the traffic to it. You can still use the cloud run url to access your app.
- Still make sure to set `host` in catladder.ts of your prod environment, so that your services know the url where there are hosted from (ROOT_URL)

Pitfalls:

- firebase will provide a CDN out-of-the-box, but will make some assumptions about your app. All cookies will be stripped, with the exception of `__session`.

### Using google load balancer

Google load balancer is a more expensive option, but it's more flexible and can be used for more complex use cases.

we suggest you use _DNS authorization_ for leasing the ssl certificate.

You will need to create some entities on google cloud. You can name them freely, but we recommend to use something like `appname-componentName` for the name. E.g. myapp-www.

We also suggest to create wildcard certificates.

First let's set up the load balancer. Best use the wizard: https://console.cloud.google.com/net-services/loadbalancing/

1. click on create
2. chose "Application Load Balancer"
3. chose "public facing"
4. use global or regional. Use regional if you have legal restrictions (it isn't cheaper than a global). If in doubt: use global.
5. chose "Global external application load balancer"
6. click "configure"
7. give name (e.g. myapp-www)
8. chose "HTTPS"
9. Unfortunatly the wizard doesn't support DNS authorization, which we will add later. But it also does not let us skip it here. So click on "create a new certificate", chose "Create Google-managed certificate" and type some fantasy domain (e.g. example.com) and name like `delete-me`
10. For backend configuration, click on "create a backend service", give it some name. Chose "serverless network endpoint group", in Backends, search your cloud run service and chose it. You can further specify CDN settings there, but you can do that later as well, so leave it as is.
11. Review everything and create it

Next, we will create a DNS authorization and a certificate.

👉 Pro tip, instead of always specifying the project (with `--project=my-google-cloud-project`), you can set the default project: `gcloud config set project my-google-cloud-project`

1. `gcloud certificate-manager dns-authorizations create myapp-www --domain="example.com"`
2. `gcloud certificate-manager certificates create myapp-www --domains="example.com,*.example.com" --dns-authorizations=myapp-www`
3. `gcloud certificate-manager maps create myapp-www`
4. `gcloud certificate-manager maps entries create myapp-www --map="myapp-www" --certificates="myapp-www" --hostname="example.com"`
5. `gcloud certificate-manager maps entries create myapp-www-wildcard --map="myapp-www" --certificates="myapp-www" --hostname="*.example.com"`
6. Now we can switch from our fake domain to the real one.
7. The load balancer wizard did set up a `target-https-proxy` for us. Verify this:
8. `gcloud compute target-https-proxies list`
9. You should see something like this:

```
NAME                     SSL_CERTIFICATES  URL_MAP    REGION  CERTIFICATE_MAP
myapp-www-target-proxy   delete-me         delete-me
```

10. `gcloud compute target-https-proxies update myapp-www-target-proxy   --certificate-map="myapp-www" --global`
11. Remove the old `delete-me` certificate form the proxy: `gcloud compute target-https-proxies update myapp-www-target-proxy   --certificate-map="myapp-www" --global`
12. Delete the old `delete-me` (classic) certificate: `gcloud compute ssl-certificates delete delete-me --global`

Now, we need to setup the DNS.

13. `gcloud certificate-manager dns-authorizations describe myapp-www` should return you information about what to add to the DNS:

```
createTime: '2025-08-11T10:09:48.402782386Z'
dnsResourceRecord:
  data: 2e759fc3-61ed-4422-9dc5-217575471c9b.11.authorize.certificatemanager.goog.
  name: _acme-challenge.example.com.
  type: CNAME
domain: example.com
name: projects/my-google-cloud-project/locations/global/dnsAuthorizations/myapp-www
type: FIXED_RECORD
updateTime: '2025-08-11T10:09:49.169018244Z'
```

14. Add the CNAME record to your DNS. Hostname `_acme-challenge.example.com.` and content is the string in `data` (`2e759fc3-61ed-4422-9dc5-217575471c9b.11.authorize.certificatemanager.goog`)
15. Wait for the certificate to be created. This can take some minutes or hours, but is usually much faster than e.g. firebase hosting. You can check the progress here: https://console.cloud.google.com/security/ccm/list/certificates
16. Once the certificate is created, you can change the A-record of your domain to point to the load balancer IP. You can find it in the load balancer console under "IP addresses".

## Monitoring & Performance

### Traces and logs

_Complexity of these topics is thoroughly described in the documentation [logging](https://www.notion.so/panterch/Logging-c13f3e36d3794ce79cc02258bc6ba07f) and [tracing](https://www.notion.so/panterch/Tracing-a7a7a774f32e4044bb65e73fffd13fa9) with more
information and examples. See subpages in Notion._

Logs are taken automatically by cloud run, so simply log to stdout and stderr is the simplest approach. However, you may want to group logs by request, or add additional context to logs. This can be achieved with structured logging and using @google-cloud/logging-winston.

However, there are certain pitfalls to be aware of, so best use this example

```ts
import winston, { format } from "winston";
import { LoggingWinston, express } from "@google-cloud/logging-winston";

const isRunningOnGoogleCloud =
  Boolean(process.env.K_SERVICE) || Boolean(process.env.CLOUD_RUN_JOB);
const googleCloudLogger = new LoggingWinston({
  redirectToStdout: true,
  useMessageField: false, // <-- bug https://github.com/googleapis/nodejs-logging-winston/issues/704
});

const myFormat = format.printf(({ level, message, timestamp, ...rest }) => {
  return `${timestamp} [${level}] ${message} ${
    rest ? JSON.stringify(rest) : ""
  }`;
});

type Config = {
  level?: string;
};
type Middleware = ReturnType<typeof express.makeMiddleware>;
export default class LoggerFactory {
  winstonLogger: winston.Logger;

  constructor(config: Config) {
    this.winstonLogger = winston.createLogger({
      level: config.level || "info",
      transports: isRunningOnGoogleCloud
        ? [googleCloudLogger]
        : [
            new winston.transports.Console({
              format: format.combine(
                format.timestamp(),
                format.colorize(),
                myFormat,
              ),
            }),
          ],
    });
  }

  public getLogger() {
    return this.winstonLogger;
  }

  public async makeExpressMiddleware(): Promise<Middleware> {
    // the middleware is a bit stupid and crashes when run locally https://github.com/googleapis/nodejs-logging-winston/issues/813
    if (isRunningOnGoogleCloud) {
      return await express.makeMiddleware(this.winstonLogger);
    } else {
      return (req, res, next) => {
        (req as any).log = this.winstonLogger;
        next();
      };
    }
  }
}
```

You can then use the `makeExpressMiddleware` so that each req has a `log` object which is an instance of a winston logger. All those logs will have the same trace as the initial request, so you can group them in google cloud logs

see also https://git.panter.ch/manul/wea/food-2050/-/blob/main/libs/logger/src/index.ts?ref_type=heads

### Tracing

Tracing allows you to see how much time is spent in which part of your app. This is useful to identify bottlenecks and to see how long a request takes.

When traces are enabled some of your requests contain traces and can be either looked at in the google cloud console or the traces explorer.

To enable traces and instrumentation in Node.js apps with GraphQL and express you can use this example:

```ts
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { ExpressInstrumentation } from "@opentelemetry/instrumentation-express";
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import {
  SimpleSpanProcessor,
  ConsoleSpanExporter,
  BatchSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { GraphQLInstrumentation } from "@opentelemetry/instrumentation-graphql";
import { TraceExporter } from "@google-cloud/opentelemetry-cloud-trace-exporter";

const provider = new NodeTracerProvider();

// Configure a test exporter to print all traces to the console

if (process.env.TRACES_CONSOLE === "true") {
  const consoleExporter = new ConsoleSpanExporter();
  provider.addSpanProcessor(new SimpleSpanProcessor(consoleExporter));
}

const exporter = new TraceExporter();

// Configure the span processor to batch and send spans to the exporter
provider.addSpanProcessor(new BatchSpanProcessor(exporter));

// Register the provider to begin tracing
provider.register();

// Register server-related instrumentation
registerInstrumentations({
  instrumentations: [
    new HttpInstrumentation(),
    new ExpressInstrumentation(),
    new GraphQLInstrumentation(),
  ],
});
```

**IMPORTANT**:

there are some pitfalls to be aware of:

- Make sure this file is the very first that you import in your server, even before importing any other library
- bundling the server using esbuild or webpack can lead to issues. Best make sure to not bundle dependencies. In esbuild this can be done using `--packages=external`. Full example: `esbuild ./src/index.ts --bundle --outfile=./dist/index.js --platform=node --keep-names --packages=external`
- if you still have problems, enable diagnostics: `diag.setLogger(new DiagConsoleLogger(), { logLevel: DiagLogLevel.ALL });` (you can import diag and the stuff from one of the opentelemetry packages)

## Migration from Kubernetes to Cloud Run

Preparations:

- make sure you have access to the DNS of your domain (see Custom domains chapter)
- Check the [CLOUD READY](/docs/recipies/CLOUD_READY) principles and make sure your app is cloud ready
- Check whether your app use background workers, cronjobs and one-time jobs to understand the cost structure
- Be aware of the costs and check whether existing hosting costs are higher or lower than your estimations

Steps:

1. Change the catladder.ts config to use `google-cloud-run` as deploy type. Don't forget to alter all jobs as well.
2. run `project-setup` in catladder-cli
3. migrate the `POSTGRESQL_PASSWORD` secret to the `DB_PASSWORD` secret.
4. Push and make sure it works on your review-branch. Test it thoroughly
5. Merge and create a release. Wait before you deploy to production.
6. If you have cronjobs and background workers, you need to manually remove them from Kubernetes because once you deploy the app to production, the new cronjobs and workers will start to operate as well.
7. Deploy it to production. Make sure it works correctly by accessing it via the cloud run url. If you have custom domains, you can already set them up, but don't change the DNS yet.
8. Change the DNS to point the public prod domain to the custom domain (firebase) or load balancer.
9. Once DNS is propagated (can take up to 24h), you can safely delete the old Kubernetes namespace as no traffic should land there any more.

### Considerations

#### min instances and scaling behaviour

Cloud run scales down to 0 when your app is not used. This is cost-efficient, but lead to "cold starts" when someone access your app after a while. A typical node app is not so fast with starting, so cold start is often too long for a user to wait.

Having 0 min instances is therefore a recommended option for all non prod-apps.

For prod-apps, consider setting minInstances to 1. Be aware of the cost implications.

#### Max instances

Cloud run scales up to 100 instances by default. This is a lot and can lead to high costs. Consider setting a max instance limit.

Bursts can happen if you are targeted with DDoS-attacks.

#### Cronjobs and one time jobs

Cronjobs and one time jobs (e.g. migrations) are supported by catladder and cloud-run. They are implemented by using a cloud run job and setting up a cloud runner, see Jobs and migrations chapter.

If you have a cronjob that runs more often then every 10 min, you might consider using a background worker instead as this is more ccost-efficient

#### Background workers

Background workers are supported by catladder and cloud-run, but there are comparably expensive, since you need to always allocate CPU and memory for them.

Check the example [cloud-run-meteor-with-worker](/docs/examples/cloud-run-meteor-with-worker) to see how to set it up.

Consider migrating away from background workers to either cronjobs are asynchronous tasks using Cloud Tasks.

#### MongoDb

We supported MongoDB in Kubernetes by using a helm chart. This is not supported in cloud run. You can use a managed MongoDB service, e.g. MongoDB atlas.

## Health Check

HTTP1 and TCP probes for health checks are supported and can be configured in `deploy.service.healthCheck`.

### Cloud Run's Default Health Check

When `deploy.service.healthCheck` is not set, Cloud Run's default health check is used. It is a TCP startup probe that checks if the container is listening on the port. No liveness probe is set.

```ts

{
  components: {
    www: {
      deploy: {
        type: "google-cloudrun",
        // ...
        service: {
          // healthCheck is not set
        },
      },
    },
  },
}
```

### Enabling Health Check

To enable default health checks, set `healthCheck` to `true`:

```ts

{
  components: {
    www: {
      deploy: {
        type: "google-cloudrun",
        // ...
        service: {
          healthCheck: true,
        },
      },
    },
  },
}
```

Default values for startup and liveness probes can be found in `defaultStartupProbe` and `defaultLivenessProbe`.

### Custom Liveness and Startup Probes

When you need custom health checks, you can use the `livenessProbe` and `startupProbe` options:

```ts
{
  components: {
    www: {
      deploy: {
        type: "google-cloudrun",
        // ...
        service: {
          healthCheck: {
            livenessProbe: {
              type: "http1",
              failureThreshold: 3,
              initialDelaySeconds: 0,
              path: "/liveness/health",
              periodSeconds: 60,
              timeoutSeconds: 30,
            },
            startupProbe: {
              type: "http1",
              failureThreshold: 3,
              initialDelaySeconds: 0,
              path: "/startup/health",
              periodSeconds: 10,
              timeoutSeconds: 5,
            },
          },
        },
      },
    },
  },
}
```
