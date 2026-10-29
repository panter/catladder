import type { Config } from "@catladder/pipeline";
import { getLocalAccessGcpEnvs } from "@catladder/pipeline";

/**
 * the envs of a component declaring gcp local access. An invalid
 * declaration yields none instead of throwing: catenv and the vault
 * cache must keep working (`project doctor` and `project setup` report
 * the invalid declaration loudly).
 */
export const getDeclaredLocalAccessEnvs = (
  config: Config,
  componentName: string,
): string[] => {
  try {
    return getLocalAccessGcpEnvs(config, componentName);
  } catch {
    return [];
  }
};
