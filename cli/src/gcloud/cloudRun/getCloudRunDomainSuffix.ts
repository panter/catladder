import type { DeployConfigCloudRun } from "@catladder/pipeline";
import { exec } from "child-process-promise";

const getSuffixFromService = (service: any) => {
  const fullUrl = service.status.url;
  const name = service.metadata.name;

  return fullUrl.replace("https://" + name + "-", "");
};
export const getCloudRunDomainSuffix = async (config: DeployConfigCloudRun) => {
  /* google cloud run domains are partially predictable, they have a fixed suffix that depends on the region and project, but we don't know it beforehand

  So what we do is either:
   - get one service and extract its suffix
   - create a dummy project, extract the suffix and save that as a gitlab variable
  
  
  */

  const dummyServiceName = "cl-dummy-service-delete-me";

  const existingServices = await exec(
    `gcloud run services list --format=json  --project="${config.projectId}"  --region=${config.region} --limit=1`
  ).then((r) => JSON.parse(r.stdout));

  if (existingServices.length > 0) {
    return getSuffixFromService(existingServices[0]);
  }

  const result = await exec(
    `gcloud run deploy ${dummyServiceName} --region=${config.region} --allow-unauthenticated --project ${config.projectId} --image=us-docker.pkg.dev/cloudrun/container/hello --format=json`
  ).then((r) => JSON.parse(r.stdout));

  return await getSuffixFromService(result);
};
