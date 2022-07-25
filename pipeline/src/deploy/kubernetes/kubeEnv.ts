import { Context } from "../../types";
import { isOfDeployType } from "../types";

const shouldGoIntoSecrets = (key: string, value: string) => {
  if (String(value)?.includes("$CL_")) {
    return true;
  }
  return false;
};

/**
 * separate by secrets and public.
 * we evalulate the actual values later, but want to store the secrets in kubernetes secrets
 */
export const createKubeEnv = (context: Context) => {
  if (!isOfDeployType(context.componentConfig.deploy, "kubernetes")) {
    // should not happen
    throw new Error("deploy config is not kubernetes");
  }

  const allEnvVars = context.environment.envVars;

  const env = Object.entries(allEnvVars).reduce<{
    secret: Record<string, string>;
    public: Record<string, string>;
  }>(
    (acc, [key, value]) => {
      if (shouldGoIntoSecrets(key, value)) {
        acc.secret = {
          ...acc.secret,
          [key]: value,
        };
        return acc;
      }
      acc.public = {
        ...acc.public,
        [key]: value,
      };
      return acc;
    },
    {
      secret: {},
      public: {},
    }
  );

  return env;
};
