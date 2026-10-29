---
"catladder": minor
---

`localAccess`: new `vertex` preset (`roles/aiplatform.user`, not read-only: it can use and bill Vertex AI and change Vertex AI resources) and `credentialsEnvVar` to have catenv also export the key file path under a name like `GOOGLE_APPLICATION_CREDENTIALS`, so local evals reach Vertex AI without a personal ADC login. Two envs exporting the same name are rejected.
