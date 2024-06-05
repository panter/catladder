import type { Config } from "../..";
import type { StringOrBashExpression } from "../../bash/BashExpression";
import { joinBashExpressions } from "../../bash/BashExpression";
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
  componentName: string
) => {
  return joinBashExpressions(
    [
      cloudSqlConfig.dbNamePrefix ??
        `${fullConfig.customerName}-${fullConfig.appName}`,
      environmentSlugPrefix,
      cloudSqlConfig.dbBaseName ?? componentName,
    ].flatMap((part) => (part ? [part] : [])),
    "-"
  );
};
