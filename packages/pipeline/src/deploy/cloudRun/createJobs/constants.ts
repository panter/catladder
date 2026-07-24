export const ENV_VARS_FILENAME = "____envvars.yaml";

/**
 * the official google cloud sdk image used by cloud run deploy/stop jobs.
 * Referenced directly (not a repo-built catladder image) because our
 * former `gcloud` image was just `FROM google/cloud-sdk:latest` and added
 * nothing — so there is no reason to ship/build it. Pinned to match the
 * gcloud SDK version baked into the `docker-build` image
 * (runner-images/docker-build/Dockerfile: GCLOUD_SDK_VERSION); bump both
 * together.
 */
export const CLOUD_SDK_IMAGE = "google/cloud-sdk:525.0.0";
