# The panter chart

**The default chart catladder deploys kubernetes components with.**

Developing helm charts can be complex and they tend to be very verbose.
Our goal is therefore to provide a common chart that provides all functionalities that you might need
and make it configurable by values.yml files in your project.

This way we avoid having complexity in the projects and make it easier to share innovations and improvements.

## Features

- scalable stateless webapplications, supports any technology
- ready-to-use but configurable ingress with optional redirects
- 1 optional worker pod (uses same image as webapp) for continuous background jobs
- configurable cronjobs
- configurable helm-hooks (post-install, post-uninstall, etc.)
- optional in-namespace mongodb. _kindof deprecated, We recommend to use google cloud dbs if possible._
- optional cloud-sql proxy that is available in webapp, worker, cronjobs and helm-hooks
- a lot of useful predefined env-vars in all pods.
- support for namespace secrets and custom env-vars (using catladder-shell and gitlab-ci)
- optional prisam1 (_deprecated, prisma2 does not need a separate instance anymore_)

See https://github.com/panter/catladder for usage information
