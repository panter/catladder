---
"catladder": patch
---

Kubernetes deploys now create a working image-pull secret on the github backend. The `kubernetesCreateSecret` script read `CI_REGISTRY_USER` / `CI_REGISTRY_PASSWORD` directly, which do not exist on GitHub Actions — the secret was created with empty credentials and pulls from a private ghcr package failed. The deploy job now passes the credentials as `DOCKER_REGISTRY_USER` / `DOCKER_REGISTRY_PASSWORD`, resolved per backend through the CI-variable abstraction (new `registryPassword`), so gitlab keeps the exact same values it used before.
