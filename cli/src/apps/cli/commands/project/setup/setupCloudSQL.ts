import type { Context } from "@catladder/pipeline";
import {
  getKubernetesCloudSQLConfig,
  hasKubernetesCloudSQL,
} from "@catladder/pipeline";
import type { CommandInstance } from "vorpal";

export const setupCloudSQL = async (
  instance: CommandInstance,
  context: Context
) => {
  if (!hasKubernetesCloudSQL(context)) {
    throw new Error("cannot setup cloudsql, as it has none");
  }
  const config = getKubernetesCloudSQLConfig(context);
  instance.log("");
  instance.log(
    "! make sure to provide cloudsqlProxyCredentials for the cloud sql service account in " +
      config.projectId
  );
  instance.log("");
};
