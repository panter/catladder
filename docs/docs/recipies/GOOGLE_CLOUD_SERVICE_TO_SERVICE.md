---
sidebar_label: Service-to-Service in gCloud
---

# Service-to-Service communication in Google Cloud

Your app may consist of multiple service, but you may not want to expose all of them to the public internet. In this case, you can use service-to-service communication to allow services to communicate with each other.

## Cloud Run

There are two options to prevent access: using authentication or using internal ingress.

### Preventing access to a service using authentication

[See also the official docs](https://cloud.google.com/run/docs/authenticating/service-to-service)

To require authentication on your service, set

```ts title="catladder.ts"
service: {
    allowUnauthenticated: false,
}
```

This will prevent unauthenticated access to this service.

### Accessing a service

You should access a non-public service through its internal ROOT_URL_INTERNAL, which is available as an environment variable. Example:

```ts title="catladder.ts, components"
["public-service-a"]: {
    vars: {
        public: {
            SERVICE_B_URL: "${secret-service-b:ROOT_URL_INTERNAL}"
        }
    },
    deploy: {
        //...
        service: {
            allowUnauthenticated: true
        }
    }
},
["secret-service-b"]: {

    deploy: {
        //...
        service: {
            allowUnauthenticated: false
        }
    }
}
```

How to access this service depends on the service you want to access it from:

#### Access from CloudTask

Tasks created by cloud task need to set the `oidcToken` field in the `httpRequest` field of the task.

[See also the official docs](https://cloud.google.com/run/docs/triggering/using-tasks?hl=de#creating_http_tasks_with_authentication_tokens)

```typescript
import { CloudTasksClient } from "@google-cloud/tasks";

cloudTaskClient.createTask({
  // ...
  task: {
    httpRequest: {
      httpMethod: "GET"
      url: url,
      oidcToken: {
        serviceAccountEmail: "YOUR_SERVICE_ACCOUNT_EMAIL",
      },
    },
  },
});
```

Usually you can use the default service account of the service that creates the task. You can use the metadata server or the `google-auth-library` to get the service account email:

```typescript
import { GoogleAuth } from "google-auth-library";

const auth = new GoogleAuth();

const getDefaultServiceAccount = async () => {
  const { client_email } = await auth.getCredentials();
  return client_email;
};
```

and then

```typescript
import { CloudTasksClient } from "@google-cloud/tasks";

cloudTaskClient.createTask({
  // ...
  task: {
    httpRequest: {
      httpMethod: "GET"
      url: url,
      oidcToken: {
        serviceAccountEmail: await getDefaultServiceAccount(),
      },
    },
  },
});
```

#### Access from another cloud run service

If you want to access a service from another Cloud Run service, you need to set an authorization header:

```typescript
// because we set allowUnauthenticated to false, we need to make authorized requests
import { GoogleAuth } from "google-auth-library";
// example using graphql-request
import { GraphQLClient } from "graphql-request";

const SERVICE_URL = process.env.SERVICE_B_URL;

const getAccessToken = async () => {
  const audience = SERVICE_URL;
  const idTokenClient = await auth.getIdTokenClient(audience);
  return await idTokenClient.idTokenProvider.fetchIdToken(audience);
};
const client = new GraphQLClient(`${SERVICE_URL}/graphql`, {
  requestMiddleware: async (request) => {
    return {
      ...request,
      headers: {
        ...request.headers,
        "X-Serverless-Authorization": `Bearer ${await getAccessToken()}`,
      },
    };
  },
});
```

`idTokenClient` can also do requests directly with `request` method.

#### Accessing locally from your development machine

You can generate an id token using the gcloud CLI:

```bash
gcloud auth print-identity-token
```

you have to include that token in the `Authorization` or `X-Serverless-Authorization` header of your request: `Authorization: Bearer ${ID_TOKEN}`

Notice that these tokens have a short life span.

### Preventing access to a service using internal ingress

Alternatively, you can set the ingress to "internal":

```typescript
// catladder.ts, components

["public-service-a"]: {
    vars: {
        public: {
            SERVICE_B_URL: "${secret-service-b:ROOT_URL_INTERNAL}"
        }
    },
    deploy: {
        // ...
    }
},
["secret-service-b"]: {

    deploy: {
        //...
        service: {
            ingress: "internal",
        }
    }
}
```

This will prevent access from the public internet to this service.

#### Access from cloud scheduler or cloud task

Cloud Scheduler and Cloud Task by default have access to all services in the same project. You don't need to do anything special.

#### Access from another cloud run service

**IT DOES NOT ALLOW DIRECT ACCESS FROM ANOTHER CLOUD RUN SERVICE**, at least not with a lot of extra configuration, so this is not recommended.
