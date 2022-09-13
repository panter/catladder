import { merge } from "lodash";
import type { DeployConfigKubernetesValues } from "..";
import type { Context } from "../../types/context";
import { mergeWithMergingArrays } from "../../utils";
import { isOfDeployType } from "../types";
import { createCloudsqlBaseConfig } from "./cloudsql";
import { createKubeEnv } from "./kubeEnv";
import { createMongodbBaseConfig } from "./mongodb";
import { processSecretsAsFiles } from "./processSecretsAsFiles";

const createAppConfig = (
  context: Context,
  application: DeployConfigKubernetesValues["application"]
): DeployConfigKubernetesValues["application"] => {
  if (application === false) {
    return {
      enabled: false,
    };
  }

  return mergeWithMergingArrays(
    {
      host: context.environment.host,
      command: context.componentConfig.build.startCommand,
      livenessProbe: {
        httpGet: {
          path: application?.healthRoute ?? "__health",
        },
      },
      readinessProbe: {
        httpGet: {
          path: application?.healthRoute ?? "__health",
        },
      },
      startupProbe: {
        httpGet: {
          path: application?.healthRoute ?? "__health",
        },
      },
    }, // default
    application // merge rest in
  );
};

export const createKubeValues = (context: Context) => {
  const deployConfig = context.componentConfig.deploy;
  if (deployConfig === false) {
    return [];
  }
  if (!isOfDeployType(deployConfig, "kubernetes")) {
    // should not happen
    throw new Error("deploy config is not kubernetes");
  }

  const { values } = deployConfig;

  // we remove the application config because it can be just the value `false` which is a convenience feature, but not supported in the helm chart
  // we only merge the rest of the values in
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { application, ...rest } = values ?? {};

  const env = createKubeEnv(context);

  const defaultKubeValues = merge(
    {
      env,
      application: createAppConfig(context, application),
    },
    deployConfig.values?.cloudsql?.enabled
      ? createCloudsqlBaseConfig(context)
      : {},
    deployConfig.values?.mongodb?.enabled
      ? createMongodbBaseConfig(context)
      : {}
  );

  const kubeValues = processSecretsAsFiles(
    mergeWithMergingArrays(defaultKubeValues, rest)
  );

  return kubeValues;
};
