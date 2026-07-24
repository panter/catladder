import type { Config } from "../..";
import type { StringOrBashExpression } from "@catladder/bash";
import { joinBashExpressions } from "@catladder/bash";
import type {
  DeployConfigCloudRunCloudSql,
  DeployConfigKubernetesValuesCloudSQLUnmanaged,
} from "../types";

export const getFullDbName = (
  cloudSqlConfig:
    | DeployConfigCloudRunCloudSql
    | DeployConfigKubernetesValuesCloudSQLUnmanaged,
  fullConfig: Config<never>,
  environmentSlugPrefix: StringOrBashExpression,
  componentName: string,
) => {
  return joinBashExpressions(
    [
      cloudSqlConfig.dbNamePrefix ??
        `${fullConfig.customerName}-${fullConfig.appName}`,
      environmentSlugPrefix,
      cloudSqlConfig.dbBaseName ?? componentName,
    ].flatMap((part) => (part ? [part] : [])),
    "-",
  );
};
