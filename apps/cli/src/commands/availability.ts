import type { ComponentContext, DeployConfigType } from "@catladder/pipeline";
import { isOfDeployType } from "@catladder/pipeline";

/** Returns an isAvailable function that checks if ANY component uses one of the given deploy types */
export function hasDeployType(
  ...types: DeployConfigType[]
): (contexts: ComponentContext[]) => boolean {
  return (contexts) =>
    contexts.some((ctx) => isOfDeployType(ctx.deploy?.config, ...types));
}

/** Returns an isAvailable function that checks if ANY component has cloudSql configured */
export function hasCloudSql(): (contexts: ComponentContext[]) => boolean {
  return (contexts) =>
    contexts.some((ctx) => {
      const cfg = ctx.deploy?.config;
      if (isOfDeployType(cfg, "google-cloudrun")) return !!cfg.cloudSql;
      if (isOfDeployType(cfg, "kubernetes"))
        return !!cfg.values?.cloudsql?.enabled;
      return false;
    });
}
