import type { Config } from "../..";
import type {
  DeployConfigCloudRunCloudSql,
  DeployConfigKubernetesValuesCloudSQLUnmanaged,
} from "../types";

export const getFullDbName = (
  cloudSqlConfig:
    | DeployConfigCloudRunCloudSql
    | DeployConfigKubernetesValuesCloudSQLUnmanaged,
  fullConfig: Config<never>,
  environmentSlugPrefix: string,
  componentName: string
) => {
  return [
    cloudSqlConfig.dbNamePrefix ??
      `${fullConfig.customerName}-${fullConfig.appName}`,
    environmentSlugPrefix,
    cloudSqlConfig.dbBaseName ?? componentName,
  ]
    .filter(Boolean)
    .join("-");
};
