import { merge } from "lodash-es";

import type {
  BuildContextComponent,
  ComponentContext,
} from "../../types/context";
import { mergeWithMergingArrays } from "../../utils";
import type { DeployConfigKubernetesValues } from "../types";
import { isOfDeployType } from "../types";
import {
  hasKubernetesCloudSQL,
  createKubernetesCloudsqlBaseValues,
} from "./cloudSql";

import { createKubeEnv } from "./kubeEnv";
import { createMongodbBaseConfig } from "./mongodb";

const createAppConfig = (
  context: ComponentContext<BuildContextComponent>,
  application: DeployConfigKubernetesValues["application"],
): DeployConfigKubernetesValues["application"] => {
  if (application === false) {
    return {
      enabled: false,
    };
  }

  const { healthRoute, command, ...rest } = application ?? {};

  return mergeWithMergingArrays(
    {
      host: context.environment.envVars.HOSTNAME,
      command:
        command ??
        (context.build.type !== "disabled"
          ? context.build.config.startCommand
          : undefined),
      livenessProbe: {
        httpGet: {
          path: healthRoute ?? "__health",
        },
      },
      readinessProbe: {
        httpGet: {
          path: healthRoute ?? "__health",
        },
      },
      startupProbe: {
        httpGet: {
          path: healthRoute ?? "__health",
        },
      },
    }, // default
    rest, // merge rest in
  );
};

const removeFalsy = <T>(record?: Record<string, false | T>) => {
  if (!record) return undefined;
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== false),
  );
};

export const createKubeValues = (
  context: ComponentContext<BuildContextComponent>,
) => {
  const deployConfig = context.deploy?.config;
  if (!deployConfig) {
    return [];
  }
  if (!isOfDeployType(deployConfig, "kubernetes")) {
    // should not happen
    throw new Error("deploy config is not kubernetes");
  }

  const { values } = deployConfig;

  // we remove the application config because it can be just the value `false` which is a convenience feature, but not supported in the helm chart
  // we only merge the rest of the values in
  const { application, jobs, cronjobs, ...rest } = values ?? {};

  const env = createKubeEnv(context);

  const defaultKubeValues = merge(
    {
      env,
      application: createAppConfig(context, application),
    },
    hasKubernetesCloudSQL(context)
      ? createKubernetesCloudsqlBaseValues(context)
      : {},
    deployConfig.values?.mongodb?.enabled
      ? createMongodbBaseConfig(context)
      : {},
  );

  const kubeValues = mergeWithMergingArrays(defaultKubeValues, {
    jobs: removeFalsy(jobs),
    cronjobs: removeFalsy(cronjobs),

    ...rest,
  });

  return kubeValues;
};
