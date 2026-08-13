---
sidebar_label: Cloud Ready
---

# Being "CLOUD READY"

The future is in MACH-Architecture, which stands for **M**icroservice **A**pi-First **C**loud-Native and **H**eadless.  
Catladder helps you with building MACH-apps without much configuration.

However, classic monolytic apps can also be deployed with catladder and on cloud infrastructure in general.

Cloud infrastructure provide good scalability and failover-safety. In order to be compatible with cloud-hosting, you should follow those principles:

### Stateless

Each Service/component of your app should be _stateless_.

The app does:

- rely on disk-volumes → use cloud storage or s3-buckets instead.
- not rely on in-memory sessions → if you really need shared-session, use something like Redis.

### No CPU and background work on web-services

A web-service, e.g. an API or SSR-app, should not do anything else than answering web-request.  
Don't run any background-jobs on web-pods. Don't do work that requires a lot of CPU ("CPU-bound").

If you need background works and/or CPU-bound work, use dedicated jobs and workers (see different deploy options).

### Can be killed and restarted anytime

In cloud hosting, instances of your app can come and go. This is to guarantee scalability and failover.

- Don't do any migrations or other work on startup on web-pods (see also previous section)
- Non-web-pods that do work should be able to resume work if it was stopped in between

### Be economical with memory-usage

Don't rely too much on memory.  
Memory can be used to speed up request.  
On jobs and workers, make sure to use good buffer-sizes, batch-sizes, etc. to not use too much memory.  
Make sure it runs on low memory and use memory only to speed up things.

_more will follow!_
