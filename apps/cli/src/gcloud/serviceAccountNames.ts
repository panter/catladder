// the naming lives in the pipeline package: pipeline generation needs it
// too, to pass the managed runtime service account to `gcloud run`
export {
  getGcloudServiceAccountNames,
  type ServiceAccountNamingContext,
} from "@catladder/pipeline";
