import type { StringOrBashExpression } from "../../bash/BashExpression";
import type { ComponentContext } from "../../types";
import { isOfDeployType } from "../types";

const shouldGoIntoSecrets = (key: string, value: string | undefined) => {
  if (!value) return false;
  if (String(value)?.includes("$CL_")) {
    return true;
  }
  return false;
};

/**
 * separate by secrets and public.
 * we evalulate the actual values later, but want to store the secrets in kubernetes secrets
 */
export const createKubeEnv = (context: ComponentContext) => {
  if (!isOfDeployType(context.deploy?.config, "kubernetes")) {
    // should not happen
    throw new Error("deploy config is not kubernetes");
  }

  const allEnvVars = context.environment.envVars;

  const env = Object.entries(allEnvVars).reduce<{
    secret: Record<string, StringOrBashExpression>;
    public: Record<string, StringOrBashExpression>;
  }>(
    (acc, [key, value]) => {
      if (shouldGoIntoSecrets(key, value?.toString())) {
        acc.secret = {
          ...acc.secret,
          [key]: value ?? "",
        };
        return acc;
      }
      acc.public = {
        ...acc.public,
        [key]: value ?? "",
      };
      return acc;
    },
    {
      secret: {},
      public: {},
    },
  );

  return env;
};
