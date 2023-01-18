import { merge } from "lodash";

import type { Context } from "../../types/context";
import { mergeWithMergingArrays } from "../../utils";
import type { DeployConfigKubernetesValues } from "../types";
import { isOfDeployType } from "../types";
import { hasKubernetesCloudSQL, createCloudsqlBaseConfig } from "./cloudSql";

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

const removeFalsy = <T>(record?: Record<string, false | T>) => {
  if (!record) return undefined;
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== false)
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
  const { application, jobs, cronjobs, ...rest } = values ?? {};

  const env = createKubeEnv(context);

  const defaultKubeValues = merge(
    {
      env,
      application: createAppConfig(context, application),
    },
    hasKubernetesCloudSQL(context) ? createCloudsqlBaseConfig(context) : {},
    deployConfig.values?.mongodb?.enabled
      ? createMongodbBaseConfig(context)
      : {}
  );

  const kubeValues = processSecretsAsFiles(
    mergeWithMergingArrays(defaultKubeValues, {
      jobs: removeFalsy(jobs),
      cronjobs: removeFalsy(cronjobs),

      ...rest,
    })
  );

  return kubeValues;
};
