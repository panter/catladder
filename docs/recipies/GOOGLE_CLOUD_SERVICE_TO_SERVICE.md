# Service-to-Service communication in Google Cloud

Your app may consist of multiple service, but you may not want to expose all of them to the public internet. In this case, you can use service-to-service communication to allow services to communicate with each other.

## Cloud Run

[See also the official docs](https://cloud.google.com/run/docs/authenticating/service-to-service)

### Preventing access to a service

If you don't want to expose a certain service, you need to set

```
service: {
    allowUnauthenticated: false,
}
```

in catladder.ts

This will prevent unauthenticated access to this service.

### Accessing a service

You should access a non-public service through its internal ROOT_URL_INTERNAL, which is available as an environment variable. Example:

```typescript
// catladder.ts, components

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

#### Access from cloud scheduler or cloud task

Cloud Scheduler and Cloud Task by default have access to all services in the same project. You don't need to do anything special.

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

`idTokenClient` also can do requests directly with `request` method.
