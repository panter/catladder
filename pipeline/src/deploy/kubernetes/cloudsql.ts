import { Context, getSecretVarName } from "../..";

export const createCloudsqlBaseConfig = (context: Context) => {
  return {
    cloudsql: {
      proxyCredentials: `$${getSecretVarName(
        context.environment.shortName,
        context.componentName,
        "cloudsqlProxyCredentials"
      )}`,
    },
  };
};
