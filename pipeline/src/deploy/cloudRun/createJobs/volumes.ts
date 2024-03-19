import type { DeployConfigCloudRunVolumes } from "../../types";
import type { keyValuesArg } from "../utils/createArgsString";

export const createVolumeConfig = (
  volumes: DeployConfigCloudRunVolumes | undefined,
  type: "service" | "job"
): keyValuesArg[] => {
  if (!volumes) {
    return [];
  }

  return [
    ...Object.entries(volumes).map(
      ([volumeName, { type, bucket, mountPath, readonly }]) => ({
        "add-volume": `name=${volumeName},type=${type},bucket=${bucket}${
          readonly ? ",readonly=true" : ""
        }`,
        "add-volume-mount": `volume=${volumeName},mount-path=${mountPath}`,
      })
    ),
    type === "service" ? { "execution-environment": "gen2" } : {},
  ];
};
