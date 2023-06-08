import type { Context } from "../types/context";
import { SBOM_FILE } from "../build/sbom";

export const sbomDeactivated = (context: Context) =>
  context.componentConfig.build.type === "custom" &&
  context.componentConfig.build.sbom === false;

export const getDependencyTrackUploadScript = (context: Context): string[] => {
  return sbomDeactivated(context)
    ? []
    : [
        "echo Uploading SBOM to Dependency Track",
        `/dtrackuploader https://dep.panter.swiss/ "$DT_KEY_PROD" upload "${context.fullConfig.customerName}-${context.fullConfig.appName}/${context.componentName}" "${context.environment.url}" "${SBOM_FILE}" vex.json || true`,
      ];
};

export const getDependencyTrackDeleteScript = (context: Context): string[] => {
  return sbomDeactivated(context)
    ? []
    : [
        "echo Disabling component in Dependency Track",
        `/dtrackuploader https://dep.panter.swiss/ "$DT_KEY_PROD" disable "${context.fullConfig.customerName}-${context.fullConfig.appName}/${context.componentName}" "${context.environment.url}" || true`,
      ];
};
