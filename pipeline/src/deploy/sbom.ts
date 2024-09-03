import { SBOM_FILE } from "../build/sbom";
import {
  componentContextIsStandaloneBuild,
  type ComponentContext,
} from "../types/context";

export const sbomDeactivated = (context: ComponentContext) =>
  componentContextIsStandaloneBuild(context) &&
  context.build.config.type === "custom" &&
  context.build.config.sbom === false;

export const getDependencyTrackUploadScript = (
  context: ComponentContext,
): string[] => {
  return sbomDeactivated(context)
    ? []
    : [
        "echo 'Uploading SBOM to Dependency Track'",
        `/dtrackuploader https://dep.panter.swiss/ "$DT_KEY_PROD" upload "${context.fullConfig.customerName}-${context.fullConfig.appName}/${context.name}" "${context.environment.envVars.ROOT_URL}" "${SBOM_FILE}" vex.json || true`,
      ];
};

export const getDependencyTrackDeleteScript = (
  context: ComponentContext,
): string[] => {
  return sbomDeactivated(context)
    ? []
    : [
        "echo 'Disabling component in Dependency Track'",
        `/dtrackuploader https://dep.panter.swiss/ "$DT_KEY_PROD" disable "${context.fullConfig.customerName}-${context.fullConfig.appName}/${context.name}" "${context.environment.envVars.ROOT_URL}" || true`,
      ];
};
