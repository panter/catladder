import { merge } from "lodash";
import { DeployConfigKubernetesValues } from "..";
import { Context } from "../../types/context";
import { mergeWithMergingArrays } from "../../utils";
import { isOfDeployType } from "../types";
import { createCloudsqlBaseConfig } from "./cloudsql";
import { createKubeEnv } from "./kubeEnv";
import { createMongodbBaseConfig } from "./mongodb";
import { processSecretsAsFiles } from "./processSecretsAsFiles";

export const createKubeValues = (context: Context) => {
  const deployConfig = context.componentConfig.deploy;
  if (deployConfig === false) {
    return [];
  }
  if (!isOfDeployType(deployConfig, "kubernetes")) {
    // should not happen
    throw new Error("deploy config is not kubernetes");
  }

  const env = createKubeEnv(context);
  const defaultAppConfig: DeployConfigKubernetesValues["application"] =
    deployConfig.values?.application === false
      ? {
          enabled: false,
        }
      : {
          host: context.environment.host,
          command: context.componentConfig.build.startCommand,
          livenessProbe: {
            httpGet: {
              path: deployConfig.values?.application?.healthRoute ?? "__health",
            },
          },
          readinessProbe: {
            httpGet: {
              path: deployConfig.values?.application?.healthRoute ?? "__health",
            },
          },
          startupProbe: {
            httpGet: {
              path: deployConfig.values?.application?.healthRoute ?? "__health",
            },
          },
        };
  const defaultKubeValues = merge(
    {
      application: defaultAppConfig,
      env: env,
    },
    deployConfig.values?.cloudsql?.enabled
      ? createCloudsqlBaseConfig(context)
      : {},
    deployConfig.values?.mongodb?.enabled
      ? createMongodbBaseConfig(context)
      : {}
  );

  const kubeValues = processSecretsAsFiles(
    mergeWithMergingArrays(defaultKubeValues, deployConfig.values)
  );

  return kubeValues;
};
